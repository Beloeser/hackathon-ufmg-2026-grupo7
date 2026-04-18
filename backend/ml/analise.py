"""
Fluxo de analise para contrato:
1) carregar modelo de vitoria (ou treinar fallback)
2) prever chance de vitoria
3) otimizar valor de acordo
4) recomendar acordo ou defesa
"""

import argparse
import json
import os
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd

from models.Acordo.train_acordo_gp import _otimizar_um_caso
from models.SucessRate.train_vitoria_gp import (
    SUBSIDIO_COLUMNS,
    _add_quantidade_subsidios,
    _aplicar_regra_subsidios,
    _build_pipeline,
    _load_dataset,
    _predict_proba_with_uncertainty,
    _prepare_xy,
    _to_taxa_vitoria,
)

PROCESS_NUMBER_COL = "Número do processo"
SUB_ASSUNTO_COL = "Sub-assunto"
VALOR_CAUSA_COL = "Valor da causa"
RESULTADO_MACRO_COL = "Resultado macro"
RESULTADO_MICRO_COL = "Resultado micro"

DEFAULT_CONTRATO = {
    PROCESS_NUMBER_COL: "1764352-89.2025.8.06.1818",
    "Contrato": 0,
    "Extrato": 0,
    "Comprovante de crédito": 0,
    "Dossiê": 1,
    "Demonstrativo de evolução da dívida": 1,
    "Laudo referenciado": 1,
    "UF": "CE",
    "Assunto": "Não reconhece operação",
    SUB_ASSUNTO_COL: "Genérico",
    VALOR_CAUSA_COL: 13534.0,
}

CONTRATO_REQUIRED_FIELDS = [
    PROCESS_NUMBER_COL,
    "Contrato",
    "Extrato",
    "Comprovante de crédito",
    "Dossiê",
    "Demonstrativo de evolução da dívida",
    "Laudo referenciado",
    SUB_ASSUNTO_COL,
    VALOR_CAUSA_COL,
]

MOJIBAKE_ALIASES = {
    "NÃºmero do processo": PROCESS_NUMBER_COL,
    "Comprovante de crÃ©dito": "Comprovante de crédito",
    "DossiÃª": "Dossiê",
    "Demonstrativo de evoluÃ§Ã£o da dÃ­vida": "Demonstrativo de evolução da dívida",
    "NÃ£o ÃŠxito": "Não Êxito",
    "Parcial procedÃªncia": "Parcial procedência",
    "ProcedÃªncia": "Procedência",
    "ExtinÃ§Ã£o": "Extinção",
}


@dataclass
class AnaliseReport:
    status: str
    model_source: str
    model_file: str
    chance_vitoria: float
    incerteza: float
    chance_vitoria_percentual: float
    valor_da_causa: float
    valor_esperado_perda: float
    valor_acordo_proposto: float
    probabilidade_aceite: float
    custo_total_esperado_acordo: float
    custo_esperado_defesa: float
    economia_esperada_com_acordo: float
    vale_pena_acordo: bool
    recomendacao: str
    contrato_analisado: Dict[str, Any]


def _repair_mojibake(text: Any) -> Any:
    if not isinstance(text, str):
        return text
    if text in MOJIBAKE_ALIASES:
        return MOJIBAKE_ALIASES[text]
    try:
        repaired = text.encode("latin1").decode("utf-8")
        return MOJIBAKE_ALIASES.get(repaired, repaired)
    except Exception:
        return text


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename_map = {col: _repair_mojibake(str(col)) for col in df.columns}
    return df.rename(columns=rename_map)


def _normalize_contract_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    return {_repair_mojibake(str(k)): v for k, v in dict(raw).items()}


def _load_training_df(input_file: str, sheet: str) -> pd.DataFrame:
    df = _load_dataset(input_file, sheet)
    return _normalize_columns(df)


def _normalizar_contrato(raw: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(raw, dict):
        raise TypeError("Contrato deve ser um objeto JSON (dicionario).")

    contrato = _normalize_contract_dict(raw)
    required_fields = [_repair_mojibake(c) for c in CONTRATO_REQUIRED_FIELDS]
    missing = [c for c in required_fields if c not in contrato]
    if missing:
        raise KeyError(f"Contrato sem campos obrigatorios: {missing}")

    for c in SUBSIDIO_COLUMNS:
        v = pd.to_numeric(pd.Series([contrato.get(c, 0)]), errors="coerce").fillna(0).iloc[0]
        contrato[c] = int(np.clip(v, 0, 1))

    contrato[SUB_ASSUNTO_COL] = str(contrato[SUB_ASSUNTO_COL])
    contrato[VALOR_CAUSA_COL] = _float_or_error(contrato[VALOR_CAUSA_COL], VALOR_CAUSA_COL)

    for k, v in list(contrato.items()):
        if pd.isna(v):
            contrato[k] = None

    return contrato


def _carregar_contratos_csv(path: str) -> pd.DataFrame:
    if not os.path.exists(path):
        raise FileNotFoundError(f"CSV de contratos nao encontrado: '{path}'")
    df = pd.read_csv(path)
    df = _normalize_columns(df)
    missing = [c for c in CONTRATO_REQUIRED_FIELDS if c not in df.columns]
    if missing:
        raise KeyError(f"CSV sem colunas obrigatorias: {missing}")
    return df


def _listar_contratos(df: pd.DataFrame) -> List[str]:
    linhas = []
    for i, row in df.iterrows():
        processo = str(row[PROCESS_NUMBER_COL])
        sub = str(row[SUB_ASSUNTO_COL])
        valor = pd.to_numeric(pd.Series([row[VALOR_CAUSA_COL]]), errors="coerce").fillna(0).iloc[0]
        linhas.append(f"[{i}] {processo} | {sub} | Valor da causa: R$ {float(valor):,.2f}")
    return linhas


def _listar_contratos_json(df: pd.DataFrame) -> Dict[str, Any]:
    contratos: List[Dict[str, Any]] = []
    for i, row in df.iterrows():
        valor = pd.to_numeric(pd.Series([row[VALOR_CAUSA_COL]]), errors="coerce").fillna(0).iloc[0]
        contratos.append(
            {
                "indice": int(i),
                "numero_processo": str(row[PROCESS_NUMBER_COL]),
                "sub_assunto": str(row[SUB_ASSUNTO_COL]),
                "valor_da_causa": float(valor),
            }
        )
    return {"status": "success", "total": int(len(contratos)), "contratos": contratos}


def _selecionar_contrato_interativo(df: pd.DataFrame) -> Dict[str, Any]:
    print("\n=== CONTRATOS DISPONIVEIS ===")
    for line in _listar_contratos(df):
        print(line)
    print()

    escolha = input("Digite o indice do contrato para analisar: ").strip()
    if not escolha:
        raise ValueError("Nenhum indice informado.")
    if not escolha.isdigit():
        raise ValueError(f"Indice invalido: '{escolha}'. Informe um numero inteiro.")

    idx = int(escolha)
    if idx < 0 or idx >= len(df):
        raise IndexError(f"Indice fora do intervalo: {idx}. Use de 0 a {len(df) - 1}.")
    return df.iloc[idx].to_dict()


def _carregar_contrato(args: argparse.Namespace) -> Dict[str, Any]:
    select_modes = [
        bool(args.contrato_json),
        bool(args.contrato_json_file),
        args.contrato_indice is not None,
        bool(args.contrato_processo),
        bool(args.interativo),
    ]
    if sum(select_modes) > 1:
        raise ValueError(
            "Use apenas um modo de selecao de contrato: --contrato-json, --contrato-json-file, "
            "--contrato-indice, --contrato-processo ou --interativo."
        )

    if args.contrato_json:
        contrato = _normalizar_contrato(json.loads(args.contrato_json))
    elif args.contrato_json_file:
        with open(args.contrato_json_file, "r", encoding="utf-8") as f:
            contrato = _normalizar_contrato(json.load(f))
    elif args.contrato_indice is not None:
        df = _carregar_contratos_csv(args.contratos_csv)
        idx = int(args.contrato_indice)
        if idx < 0 or idx >= len(df):
            raise IndexError(f"Indice fora do intervalo: {idx}. Use de 0 a {len(df) - 1}.")
        contrato = _normalizar_contrato(df.iloc[idx].to_dict())
    elif args.contrato_processo:
        df = _carregar_contratos_csv(args.contratos_csv)
        mask = df[PROCESS_NUMBER_COL].astype(str) == str(args.contrato_processo)
        if not mask.any():
            raise ValueError(f"Processo '{args.contrato_processo}' nao encontrado em '{args.contratos_csv}'.")
        contrato = _normalizar_contrato(df.loc[mask].iloc[0].to_dict())
    elif args.interativo:
        df = _carregar_contratos_csv(args.contratos_csv)
        contrato = _normalizar_contrato(_selecionar_contrato_interativo(df))
    else:
        contrato = _normalizar_contrato(DEFAULT_CONTRATO.copy())

    return contrato


def _treinar_modelo_vitoria(
    *,
    input_file: str,
    sheet: str,
    model_file: str,
    target_mode: str,
    positive_label: str,
    micro_mapping: dict,
    categorical_encoding: str,
    penalidade_por_subsidio: float,
    exclude_resultado_micro: str,
    max_train_rows: int,
    random_state: int,
) -> Dict[str, Any]:
    df = _load_training_df(input_file, sheet)

    if exclude_resultado_micro:
        exclude_value = _repair_mojibake(str(exclude_resultado_micro).strip())
        if RESULTADO_MICRO_COL not in df.columns:
            raise KeyError("Coluna 'Resultado micro' nao encontrada para aplicar o filtro solicitado.")
        mask_exclude = df[RESULTADO_MICRO_COL].astype(str).str.strip() == exclude_value
        df = df.loc[~mask_exclude].reset_index(drop=True)

    df = _add_quantidade_subsidios(df)

    target_col = RESULTADO_MACRO_COL if target_mode == "vitoria_macro" else RESULTADO_MICRO_COL
    categorical_cols = [SUB_ASSUNTO_COL]
    numeric_cols = [VALOR_CAUSA_COL]

    X, y = _prepare_xy(
        df,
        target_col=target_col,
        positive_label=_repair_mojibake(positive_label),
        target_mode=target_mode,
        micro_mapping={_repair_mojibake(k): v for k, v in micro_mapping.items()},
        categorical_cols=categorical_cols,
        numeric_cols=numeric_cols,
    )

    if max_train_rows and max_train_rows > 0 and len(X) > max_train_rows:
        rng = np.random.default_rng(random_state)
        idx = rng.choice(len(X), size=int(max_train_rows), replace=False)
        X_fit = X.iloc[idx]
        y_fit = y[idx]
    else:
        X_fit = X
        y_fit = y

    pipe = _build_pipeline(
        categorical_cols,
        numeric_cols,
        categorical_encoding=categorical_encoding,
    )
    pipe.fit(X_fit, y_fit)
    train_pred = np.asarray(pipe.predict(X_fit), dtype=float)
    pipe._prediction_std = float(np.std(np.asarray(y_fit, dtype=float) - train_pred))

    payload = {
        "pipeline": pipe,
        "pipelines": [pipe],
        "model_type": "linear_regression",
        "ensemble_size": 1,
        "chunk_size": None,
        "n_rows_total": int(len(X_fit)),
        "target_mode": target_mode,
        "positive_label": _repair_mojibake(positive_label),
        "micro_mapping": {_repair_mojibake(k): v for k, v in micro_mapping.items()},
        "features_categorical": categorical_cols,
        "features_numeric": numeric_cols,
        "subsidio_columns": SUBSIDIO_COLUMNS,
        "penalidade_por_subsidio": float(penalidade_por_subsidio),
    }

    os.makedirs(os.path.dirname(model_file) or ".", exist_ok=True)
    joblib.dump(payload, model_file)
    return payload


def _carregar_modelo(model_file: str) -> Dict[str, Any]:
    raw = joblib.load(model_file)
    if isinstance(raw, dict) and ("pipeline" in raw or "pipelines" in raw):
        payload = raw
    else:
        payload = {
            "pipeline": raw,
            "pipelines": [raw],
            "model_type": "desconhecido",
            "ensemble_size": 1,
            "chunk_size": None,
            "n_rows_total": None,
            "target_mode": "vitoria_macro",
            "features_categorical": [SUB_ASSUNTO_COL],
            "features_numeric": [VALOR_CAUSA_COL],
            "subsidio_columns": SUBSIDIO_COLUMNS,
        }

    if "pipelines" not in payload:
        payload["pipelines"] = [payload["pipeline"]] if payload.get("pipeline") is not None else []

    if "model_type" not in payload:
        first_pipe = payload["pipelines"][0] if payload.get("pipelines") else payload.get("pipeline")
        named_steps = getattr(first_pipe, "named_steps", {})
        if "gpr" in named_steps:
            payload["model_type"] = "gaussian_process"
        elif "regressor" in named_steps:
            estimator_name = named_steps["regressor"].__class__.__name__.lower()
            if "linearregression" in estimator_name:
                payload["model_type"] = "linear_regression"
            else:
                payload["model_type"] = estimator_name
        else:
            payload["model_type"] = "desconhecido"

    payload.setdefault("target_mode", "vitoria_macro")
    payload.setdefault("features_categorical", [SUB_ASSUNTO_COL])
    payload.setdefault("features_numeric", [VALOR_CAUSA_COL])
    payload.setdefault("subsidio_columns", SUBSIDIO_COLUMNS)
    payload.setdefault("penalidade_por_subsidio", 0.0)
    payload.setdefault("ensemble_size", len(payload.get("pipelines", [])) or 1)
    return payload


def _prever_chance_vitoria(model_payload: Dict[str, Any], contrato: Dict[str, Any]) -> Tuple[float, float]:
    categorias = list(model_payload["features_categorical"])
    numericas = list(model_payload["features_numeric"])
    target_mode = str(model_payload["target_mode"])
    subsidios = list(model_payload["subsidio_columns"])

    contrato_row = dict(contrato)
    for col in subsidios:
        contrato_row[col] = contrato_row.get(col, 0)

    faltantes = [c for c in categorias + [VALOR_CAUSA_COL] if c not in contrato_row]
    if faltantes:
        raise KeyError(f"Contrato novo sem campos obrigatorios: {faltantes}")

    one = pd.DataFrame([contrato_row])
    one = _add_quantidade_subsidios(one)

    X_new = one[categorias + numericas].copy()
    for c in numericas:
        X_new[c] = pd.to_numeric(X_new[c], errors="coerce")
    X_new = X_new.fillna(0)

    pipelines = [p for p in model_payload.get("pipelines", []) if p is not None]
    if not pipelines:
        pipeline = model_payload.get("pipeline")
        if pipeline is None:
            raise ValueError("Modelo carregado sem pipeline para inferencia.")
        pipelines = [pipeline]

    taxas = []
    stds = []
    for pipe in pipelines:
        proba, std = _predict_proba_with_uncertainty(pipe, X_new)
        taxas.append(float(_to_taxa_vitoria(proba, target_mode)[0]))
        stds.append(float(std[0]))

    taxa_vitoria_base = np.array([float(np.mean(taxas))], dtype=float)
    qtd_subsidios = pd.to_numeric(one["quantidade_subsidios"], errors="coerce").fillna(0.0).to_numpy()
    taxa_vitoria = float(
        _aplicar_regra_subsidios(
            taxa_vitoria_base,
            qtd_subsidios,
            float(model_payload.get("penalidade_por_subsidio", 0.0)),
        )[0]
    )
    incerteza = float(np.sqrt(np.mean(np.square(stds))))
    return taxa_vitoria, incerteza


def _float_or_error(value: Any, field_name: str) -> float:
    out = pd.to_numeric(pd.Series([value]), errors="coerce").iloc[0]
    if pd.isna(out):
        raise ValueError(f"Campo '{field_name}' invalido ou ausente: {value}")
    return float(out)


def _calcular_economia(
    *,
    valor_esperado_perda: float,
    custo_total_esperado_acordo: float,
    custo_defesa: float,
) -> Dict[str, float]:
    custo_esperado_defesa = float(valor_esperado_perda) + float(custo_defesa)
    economia_estimada = custo_esperado_defesa - float(custo_total_esperado_acordo)
    lucro_estimado_economia = max(economia_estimada, 0.0)
    prejuizo_estimado_economia = max(-economia_estimada, 0.0)

    return {
        "custo_esperado_defesa": float(custo_esperado_defesa),
        "economia_estimada": float(economia_estimada),
        "lucro_estimado_economia": float(lucro_estimado_economia),
        "prejuizo_estimado_economia": float(prejuizo_estimado_economia),
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Analisa contrato: chance de vitoria, acordo sugerido e recomendacao."
    )

    parser.add_argument("--contrato-json", default=None, help="JSON do contrato novo em linha unica.")
    parser.add_argument("--contrato-json-file", default=None, help="Caminho para arquivo JSON do contrato novo.")
    parser.add_argument(
        "--contratos-csv",
        default=os.path.join("db", "processed", "processos_em_andamento.csv"),
        help="CSV com contratos para selecao por indice/processo.",
    )
    parser.add_argument(
        "--contrato-indice",
        type=int,
        default=None,
        help="Seleciona o contrato pela posicao no --contratos-csv.",
    )
    parser.add_argument(
        "--contrato-processo",
        default=None,
        help=f"Seleciona o contrato pelo '{PROCESS_NUMBER_COL}' no --contratos-csv.",
    )
    parser.add_argument("--interativo", action="store_true", help="Mostra lista e pede indice no terminal.")
    parser.add_argument("--listar-contratos", action="store_true", help="Lista os contratos do CSV e encerra.")
    parser.add_argument(
        "--listar-contratos-json",
        action="store_true",
        help="Lista os contratos do CSV em JSON e encerra.",
    )

    parser.add_argument(
        "--model-file",
        default=os.path.join("db", "processed", "gp_vitoria_model.joblib"),
        help="Modelo treinado de vitoria (.joblib).",
    )
    parser.add_argument(
        "--train-file",
        default=os.path.join("db", "raw", "Hackaton_Enter_Base_Candidatos.csv"),
        help="Base de treino para fallback caso o modelo nao exista.",
    )
    parser.add_argument("--sheet", default="merge_excel")
    parser.add_argument("--train-if-missing", action="store_true", help="Treina modelo se --model-file nao existir.")
    parser.add_argument("--force-retrain", action="store_true", help="Ignora modelo salvo e treina novamente.")

    parser.add_argument("--target-mode", default="vitoria_macro", choices=["vitoria_macro", "severidade_micro"])
    parser.add_argument("--positive-label", default="Êxito")
    parser.add_argument(
        "--micro-mapping",
        default='{"Improcedência": 0, "Parcial procedência": 0.5, "Procedência": 1, "Acordo": 0.5}',
    )
    parser.add_argument("--categorical-encoding", default="ordinal", choices=["ordinal", "onehot"])
    parser.add_argument(
        "--penalidade-por-subsidio",
        type=float,
        default=0.0,
        help="Penalidade multiplicativa aplicada a chance de vitoria para cada subsidio.",
    )
    parser.add_argument("--quantidade-subsidios-weight", type=float, default=None, help=argparse.SUPPRESS)
    parser.add_argument("--exclude-resultado-micro", default="Extinção")
    parser.add_argument(
        "--max-train-rows",
        type=int,
        default=5000,
        help=(
            "Tamanho maximo de amostra para treino da regressao linear. "
            "Se a base for maior, o sistema usa amostragem aleatoria para acelerar o treino."
        ),
    )
    parser.add_argument("--random-state", type=int, default=42)

    parser.add_argument("--alpha", type=float, default=0.7)
    parser.add_argument("--k-base", type=float, default=10.0)
    parser.add_argument("--c-extra-fixed", type=float, default=1000.0)
    parser.add_argument("--c-extra-ratio", type=float, default=0.0)
    parser.add_argument("--min-offer-frac", type=float, default=0.05)
    parser.add_argument("--max-offer-frac", type=float, default=1.0)
    parser.add_argument("--x0-frac", type=float, default=0.5)

    parser.add_argument(
        "--custo-defesa",
        type=float,
        default=7000.0,
        help="Custo esperado para seguir litigando sem acordo.",
    )
    parser.add_argument(
        "--output",
        default="resumo",
        choices=["resumo", "valor_acordo", "completo"],
        help="Formato da saida: resumo, valor_acordo ou completo.",
    )

    args = parser.parse_args()

    if args.listar_contratos:
        df = _carregar_contratos_csv(args.contratos_csv)
        print("\n".join(_listar_contratos(df)))
        return 0
    if args.listar_contratos_json:
        df = _carregar_contratos_csv(args.contratos_csv)
        print(json.dumps(_listar_contratos_json(df), ensure_ascii=False))
        return 0

    contrato = _carregar_contrato(args)
    model_source = "arquivo"

    if (not os.path.exists(args.model_file)) or args.force_retrain:
        if not args.train_if_missing and not args.force_retrain:
            raise FileNotFoundError(
                f"Modelo nao encontrado em '{args.model_file}'. Use --train-if-missing ou --force-retrain."
            )

        micro_mapping = json.loads(args.micro_mapping)
        model_payload = _treinar_modelo_vitoria(
            input_file=args.train_file,
            sheet=args.sheet,
            model_file=args.model_file,
            target_mode=args.target_mode,
            positive_label=args.positive_label,
            micro_mapping=micro_mapping,
            categorical_encoding=args.categorical_encoding,
            penalidade_por_subsidio=args.penalidade_por_subsidio,
            exclude_resultado_micro=args.exclude_resultado_micro,
            max_train_rows=args.max_train_rows,
            random_state=args.random_state,
        )
        model_source = "treinado_no_momento"
    else:
        model_payload = _carregar_modelo(args.model_file)
        needs_retrain = str(model_payload.get("model_type", "")).strip().lower() != "linear_regression"
        if not needs_retrain and args.target_mode == "vitoria_macro":
            expected_positive = _repair_mojibake(str(args.positive_label).strip())
            saved_positive = _repair_mojibake(str(model_payload.get("positive_label", "")).strip())
            if saved_positive != expected_positive:
                needs_retrain = True

        if needs_retrain:
            micro_mapping = json.loads(args.micro_mapping)
            model_payload = _treinar_modelo_vitoria(
                input_file=args.train_file,
                sheet=args.sheet,
                model_file=args.model_file,
                target_mode=args.target_mode,
                positive_label=args.positive_label,
                micro_mapping=micro_mapping,
                categorical_encoding=args.categorical_encoding,
                penalidade_por_subsidio=args.penalidade_por_subsidio,
                exclude_resultado_micro=args.exclude_resultado_micro,
                max_train_rows=args.max_train_rows,
                random_state=args.random_state,
            )
            model_source = "retreinado_no_momento"

    taxa_vitoria, incerteza = _prever_chance_vitoria(model_payload, contrato)
    valor_da_causa = _float_or_error(contrato.get(VALOR_CAUSA_COL), VALOR_CAUSA_COL)

    valor_acordo, prob_aceite, custo_total_esperado, valor_esperado_perda = _otimizar_um_caso(
        valor_pedido=valor_da_causa,
        chance_vitoria=taxa_vitoria,
        c_extra_fixed=args.c_extra_fixed,
        c_extra_ratio=args.c_extra_ratio,
        alpha=args.alpha,
        k_base=args.k_base,
        min_offer_frac=args.min_offer_frac,
        max_offer_frac=args.max_offer_frac,
        x0_frac=args.x0_frac,
    )

    economia_info = _calcular_economia(
        valor_esperado_perda=float(valor_esperado_perda),
        custo_total_esperado_acordo=float(custo_total_esperado),
        custo_defesa=float(args.custo_defesa),
    )
    custo_esperado_defesa = float(economia_info["custo_esperado_defesa"])
    economia_acordo = float(economia_info["economia_estimada"])
    lucro_estimado_economia = float(economia_info["lucro_estimado_economia"])
    prejuizo_estimado_economia = float(economia_info["prejuizo_estimado_economia"])
    vale_pena_acordo = bool(economia_acordo > 0)
    recomendacao = "Buscar acordo" if vale_pena_acordo else "Ir para defesa"

    report = AnaliseReport(
        status="success",
        model_source=model_source,
        model_file=args.model_file,
        chance_vitoria=float(np.clip(taxa_vitoria, 0.0, 1.0)),
        incerteza=max(float(incerteza), 0.0),
        chance_vitoria_percentual=float(np.clip(taxa_vitoria * 100.0, 0.0, 100.0)),
        valor_da_causa=valor_da_causa,
        valor_esperado_perda=float(valor_esperado_perda),
        valor_acordo_proposto=float(valor_acordo),
        probabilidade_aceite=float(np.clip(prob_aceite, 0.0, 1.0)),
        custo_total_esperado_acordo=float(custo_total_esperado),
        custo_esperado_defesa=float(custo_esperado_defesa),
        economia_esperada_com_acordo=float(economia_acordo),
        vale_pena_acordo=vale_pena_acordo,
        recomendacao=recomendacao,
        contrato_analisado=contrato,
    )

    if args.output == "resumo":
        print(
            json.dumps(
                {
                    "taxa_probabilidade_vitoria": round(float(np.clip(taxa_vitoria * 100.0, 0.0, 100.0)), 2),
                    "fazer_acordo": vale_pena_acordo,
                    "valor_acordo_justo": float(valor_acordo) if vale_pena_acordo else None,
                    "economia_estimada": float(economia_acordo),
                    "lucro_estimado_economia": float(lucro_estimado_economia),
                    "prejuizo_estimado_economia": float(prejuizo_estimado_economia),
                    "custo_esperado_defesa": float(custo_esperado_defesa),
                    "custo_total_esperado_acordo": float(custo_total_esperado),
                },
                ensure_ascii=False,
            )
        )
    elif args.output == "valor_acordo":
        print(json.dumps({"status": "success", "valor_acordo_justo": float(valor_acordo)}, ensure_ascii=False))
    else:
        print(json.dumps(asdict(report), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
        raise SystemExit(1)
