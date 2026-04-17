import json
import sys

def process_data(data):
    """Exemplo de processamento de dados com ML"""
    result = {
        "status": "success",
        "processed": True,
        "data": data
    }
    return result

if __name__ == "__main__":
    try:
        # Receber dados do stdin ou argumentos
        data = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        result = process_data(data)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))
        sys.exit(1)
