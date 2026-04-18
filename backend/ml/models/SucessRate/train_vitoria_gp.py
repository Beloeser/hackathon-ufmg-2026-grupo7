import argparse
import json
import os
from dataclasses import asdict, dataclass
from typing import List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression
from sklearn.metrics import accuracy_score, brier_score_loss, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler


@dataclass
class TrainReport:
    status: str
    input_file: str
    predictions_csv_path: str
    model_path: str
    n_rows_total: int
    n_rows_filtered_out: int
    n_rows_used: int
    random_state: int
    test_size: float
    features_categorical: List[str]
    features_numeric: List[str]
    target_column: str
    positive_label: str
    excluded_resultado_micro: str
    target_mode: str
    micro_mapping: dict
    metrics: dict


def _load_dataset(path: str, sheet: str) -> pd.DataFrame:
    lower_path = path.lower()
    if lower_path.endswith(".csv"):
        return pd.read_csv(path)
    if lower_path.endswith(".xlsx") or lower_path.endswith(".xls"):
        return pd.read_excel(path, sheet_name=sheet, engine="openpyxl")
    raise ValueError(f"Formato de entrada nao suportado: {path}. Use .csv, .xlsx ou .xls.")


SUBSIDIO_COLUMNS = [
    "Contrato",
    "Extrato",
    "Comprovante de crédito",
    "Dossiê",
    "Demonstrativo de evolução da dívida",
    "Laudo referenciado",
]


def _add_quantidade_subsidios(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    if "Comprovante de crédito" not in out.columns and "Comprovante de credito" in out.columns:
        out["Comprovante de crédito"] = out["Comprovante de credito"]
    if "Dossiê" not in out.columns and "Dossie" in out.columns:
        out["Dossiê"] = out["Dossie"]
    if "Demonstrativo de evolução da dívida" not in out.columns and "Demonstrativo de evolucao da divida" in out.columns:
        out["Demonstrativo de evolução da dívida"] = out["Demonstrativo de evolucao da divida"]

    missing = [c for c in SUBSIDIO_COLUMNS if c not in out.columns]
    if missing:
        raise KeyError(f"Colunas de subsidio ausentes para contar: {missing}")

    mat = out[SUBSIDIO_COLUMNS].apply(pd.to_numeric, errors="coerce").fillna(0)
    out["quantidade_subsidios"] = mat.sum(axis=1).astype(int)
    return out


def _prepare_xy(
    df: pd.DataFrame,
    *,
    target_col: str,
    positive_label: str,
    target_mode: str,
    micro_mapping: dict,
    categorical_cols: List[str],
    numeric_cols: List[str],
) -> Tuple[pd.DataFrame, np.ndarray]:
    missing = [c for c in (categorical_cols + numeric_cols + [target_col]) if c not in df.columns]
    if missing:
        raise KeyError(f"Colunas ausentes: {missing}. Colunas disponiveis: {list(df.columns)}")

    if target_mode == "vitoria_macro":
        y = (df[target_col].astype(str).str.strip() == positive_label).astype(float).to_numpy()
    elif target_mode == "severidade_micro":
        micro = df[target_col].astype(str).str.strip()
        y = micro.map(micro_mapping).astype(float).to_numpy()
        if np.isnan(y).any():
            unknown = sorted(set(micro[~micro.isin(list(micro_mapping.keys()))].unique().tolist()))
            raise ValueError(
                f"Ha valores de '{target_col}' sem mapeamento: {unknown}. Ajuste --micro-mapping."
            )
    else:
        raise ValueError("--target-mode invalido. Use 'vitoria_macro' ou 'severidade_micro'.")

    X = df[categorical_cols + numeric_cols].copy()
    for c in numeric_cols:
        X[c] = pd.to_numeric(X[c], errors="coerce")
    X = X.fillna(0)
    return X, y


def _build_pipeline(
    categorical_cols: List[str],
    numeric_cols: List[str],
    *,
    categorical_encoding: str,
) -> Pipeline:
    if categorical_encoding not in {"ordinal", "onehot"}:
        raise ValueError("--categorical-encoding deve ser 'ordinal' ou 'onehot'")

    if categorical_encoding == "ordinal":
        cat_transformer = Pipeline(
            [
                (
                    "ordinal",
                    OrdinalEncoder(
                        handle_unknown="use_encoded_value",
                        unknown_value=-1,
                    ),
                ),
                ("scaler", StandardScaler()),
            ]
        )
    else:
        from sklearn.preprocessing import OneHotEncoder

        cat_transformer = OneHotEncoder(handle_unknown="ignore", sparse_output=False)

    pre = ColumnTransformer(
        transformers=[
            ("cat", cat_transformer, categorical_cols),
            ("num", Pipeline([("scaler", StandardScaler())]), numeric_cols),
        ],
        remainder="drop",
        verbose_feature_names_out=False,
    )

    regressor = LinearRegression()
    return Pipeline([("pre", pre), ("regressor", regressor)])


def _predict_proba_with_uncertainty(pipe: Pipeline, X: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray]:
    pred = np.asarray(pipe.predict(X), dtype=float)
    proba = np.clip(pred, 0.0, 1.0)
    base_std = float(getattr(pipe, "_prediction_std", 0.0))
    std = np.full_like(proba, fill_value=max(base_std, 0.0), dtype=float)
    return proba, std


def _to_taxa_vitoria(score: np.ndarray, target_mode: str) -> np.ndarray:
    if target_mode == "severidade_micro":
        return np.clip(1.0 - score, 0.0, 1.0)
    return np.clip(score, 0.0, 1.0)


def _aplicar_regra_subsidios(
    taxa_vitoria: np.ndarray, quantidade_subsidios: np.ndarray, penalidade_por_subsidio: float
) -> np.ndarray:
    taxa = np.clip(np.asarray(taxa_vitoria, dtype=float), 0.0, 1.0)
    qtd = np.clip(np.asarray(quantidade_subsidios, dtype=float), 0.0, float(len(SUBSIDIO_COLUMNS)))
    fator = 1.0 - float(penalidade_por_subsidio) * qtd
    return np.clip(taxa * fator, 0.0, 1.0)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Treina regressao linear para chance de vitoria (compatibilidade de modulo)."
    )
    parser.add_argument(
        "--input-file",
        default=os.path.join("db", "raw", "Hackaton_Enter_Base_Candidatos.csv"),
        help="Dataset de treino (.csv, .xlsx ou .xls).",
    )
    parser.add_argument(
        "--input-xlsx",
        default=None,
        help="Compatibilidade legada: se informado, sobrescreve --input-file.",
    )
    parser.add_argument("--sheet", default="merge_excel")
    parser.add_argument(
        "--predictions-csv-out",
        default=os.path.join("db", "processed", "gp_treino_resultados.csv"),
        help="CSV com taxa_vitoria, incerteza e valor_da_causa para uso em novos treinamentos.",
    )
    parser.add_argument(
        "--model-out",
        default=os.path.join("db", "processed", "gp_vitoria_model.joblib"),
        help="Arquivo joblib para persistir o pipeline treinado e metadados de inferencia.",
    )
    parser.add_argument(
        "--target-mode",
        default="vitoria_macro",
        choices=["vitoria_macro", "severidade_micro"],
        help=(
            "Tipo de alvo. 'vitoria_macro' usa Resultado macro binario. "
            "'severidade_micro' aprende: 0=Improcedencia, 0.5=Parcial procedencia, 1=Procedencia."
        ),
    )
    parser.add_argument(
        "--target-col",
        default=None,
        help="Coluna alvo. Se omitido: Resultado macro (vitoria_macro) ou Resultado micro (severidade_micro).",
    )
    parser.add_argument("--positive-label", default="Êxito")
    parser.add_argument(
        "--micro-mapping",
        default='{"Improcedência": 0, "Parcial procedência": 0.5, "Procedência": 1, "Acordo": 0.5}',
        help="JSON com mapeamento de Resultado micro -> numero (usado em severidade_micro).",
    )
    parser.add_argument(
        "--categorical-encoding",
        default="ordinal",
        choices=["ordinal", "onehot"],
        help="Como transformar texto em numero.",
    )
    parser.add_argument(
        "--exclude-resultado-micro",
        default="Extinção",
        help="Remove do treino/validacao linhas com este valor em Resultado micro.",
    )
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument(
        "--max-train-rows",
        type=int,
        default=5000,
        help="Tamanho maximo de amostra para treino da regressao linear. Use 0 para usar tudo.",
    )
    parser.add_argument(
        "--penalidade-por-subsidio",
        type=float,
        default=0.0,
        help="Penalidade multiplicativa aplicada a chance de vitoria para cada subsidio.",
    )
    parser.add_argument("--quantidade-subsidios-weight", type=float, default=None, help=argparse.SUPPRESS)
    args = parser.parse_args()

    micro_mapping = json.loads(args.micro_mapping)
    if args.target_col is None:
        args.target_col = "Resultado macro" if args.target_mode == "vitoria_macro" else "Resultado micro"

    input_file = args.input_xlsx or args.input_file
    df = _load_dataset(input_file, args.sheet)
    n_total = int(len(df))
    n_filtered_out = 0

    if args.exclude_resultado_micro:
        if "Resultado micro" not in df.columns:
            raise KeyError("Coluna 'Resultado micro' nao encontrada para aplicar o filtro solicitado.")
        mask_exclude = df["Resultado micro"].astype(str).str.strip() == str(args.exclude_resultado_micro).strip()
        n_filtered_out = int(mask_exclude.sum())
        df = df.loc[~mask_exclude].reset_index(drop=True)

    df = _add_quantidade_subsidios(df)
    categorical_cols = ["Sub-assunto"]
    numeric_cols = ["Valor da causa"]

    X, y = _prepare_xy(
        df,
        target_col=args.target_col,
        positive_label=args.positive_label,
        target_mode=args.target_mode,
        micro_mapping=micro_mapping,
        categorical_cols=categorical_cols,
        numeric_cols=numeric_cols,
    )

    stratify_target = y if args.target_mode == "vitoria_macro" else None
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=args.test_size, random_state=args.random_state, stratify=stratify_target
    )

    if args.max_train_rows and args.max_train_rows > 0 and len(X_train) > args.max_train_rows:
        rng = np.random.default_rng(args.random_state)
        idx = rng.choice(len(X_train), size=args.max_train_rows, replace=False)
        X_fit = X_train.iloc[idx]
        y_fit = y_train[idx]
    else:
        X_fit = X_train
        y_fit = y_train

    pipe = _build_pipeline(
        categorical_cols,
        numeric_cols,
        categorical_encoding=args.categorical_encoding,
    )
    pipe.fit(X_fit, y_fit)
    train_pred = np.asarray(pipe.predict(X_fit), dtype=float)
    pipe._prediction_std = float(np.std(np.asarray(y_fit, dtype=float) - train_pred))

    model_payload = {
        "pipeline": pipe,
        "model_type": "linear_regression",
        "target_mode": args.target_mode,
        "features_categorical": categorical_cols,
        "features_numeric": numeric_cols,
        "categorical_encoding": args.categorical_encoding,
        "positive_label": args.positive_label,
        "micro_mapping": micro_mapping,
        "subsidio_columns": SUBSIDIO_COLUMNS,
        "penalidade_por_subsidio": float(args.penalidade_por_subsidio),
    }
    os.makedirs(os.path.dirname(args.model_out) or ".", exist_ok=True)
    joblib.dump(model_payload, args.model_out)

    proba, std = _predict_proba_with_uncertainty(pipe, X_test)
    qtd_test = pd.to_numeric(df.loc[X_test.index, "quantidade_subsidios"], errors="coerce").fillna(0.0).to_numpy()
    taxa_vitoria_test = _to_taxa_vitoria(proba, args.target_mode)
    taxa_vitoria_test = _aplicar_regra_subsidios(
        taxa_vitoria_test, qtd_test, args.penalidade_por_subsidio
    )

    metrics = {"mean_std": float(np.mean(std))}
    if args.target_mode == "vitoria_macro":
        y_pred = (taxa_vitoria_test >= 0.5).astype(float)
        metrics.update(
            {
                "roc_auc": float(roc_auc_score(y_test, taxa_vitoria_test)),
                "accuracy@0.5": float(accuracy_score(y_test, y_pred)),
                "brier": float(brier_score_loss(y_test, taxa_vitoria_test)),
            }
        )
    else:
        mse = float(np.mean((taxa_vitoria_test - y_test) ** 2))
        mae = float(np.mean(np.abs(taxa_vitoria_test - y_test)))
        metrics.update({"mse": mse, "mae": mae})

    proba_all, std_all = _predict_proba_with_uncertainty(pipe, X)
    qtd_all = pd.to_numeric(df["quantidade_subsidios"], errors="coerce").fillna(0.0).to_numpy()
    taxa_vitoria_all = _to_taxa_vitoria(proba_all, args.target_mode)
    taxa_vitoria_all = _aplicar_regra_subsidios(
        taxa_vitoria_all, qtd_all, args.penalidade_por_subsidio
    )

    valor_da_causa = pd.to_numeric(df.get("Valor da causa", 0), errors="coerce").fillna(0.0)
    predictions_df = pd.DataFrame(
        {
            "taxa_vitoria": taxa_vitoria_all,
            "incerteza": std_all,
            "valor_da_causa": valor_da_causa,
        }
    )
    if "Número do processo" in df.columns:
        predictions_df.insert(0, "numero_processo", df["Número do processo"])

    os.makedirs(os.path.dirname(args.predictions_csv_out) or ".", exist_ok=True)
    predictions_df.to_csv(args.predictions_csv_out, index=False, encoding="utf-8-sig")

    report = TrainReport(
        status="success",
        input_file=input_file,
        predictions_csv_path=args.predictions_csv_out,
        model_path=args.model_out,
        n_rows_total=n_total,
        n_rows_filtered_out=n_filtered_out,
        n_rows_used=int(len(X_fit)),
        random_state=args.random_state,
        test_size=float(args.test_size),
        features_categorical=categorical_cols,
        features_numeric=numeric_cols,
        target_column=args.target_col,
        positive_label=args.positive_label,
        excluded_resultado_micro=str(args.exclude_resultado_micro),
        target_mode=str(args.target_mode),
        micro_mapping=micro_mapping,
        metrics=metrics,
    )

    print(json.dumps(asdict(report), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
