#!/usr/bin/env bash
# =========================================================
# Genera un certificado TLS autofirmado para desarrollo/pruebas locales.
#
# Los navegadores y Node.js modernos exigen la extension SAN
# (Subject Alternative Name); un certificado sin ella (solo con CN)
# sera rechazado con ERR_CERT_COMMON_NAME_INVALID. Por eso se usa
# un archivo de configuracion temporal con [alt_names].
#
# Uso:
#   bash scripts/generar-certificado.sh
#
# Genera:
#   certs/key.pem   -> clave privada (NO subir a git / NO compartir)
#   certs/cert.pem  -> certificado publico autofirmado
# =========================================================
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$DIR/certs"
mkdir -p "$CERT_DIR"

CONFIG_FILE=$(mktemp)
cat > "$CONFIG_FILE" <<EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C  = MX
ST = Local
L  = Local
O  = RedSocial Dev
CN = localhost

[v3_req]
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1  = 127.0.0.1
IP.2  = ::1
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$CERT_DIR/key.pem" \
  -out "$CERT_DIR/cert.pem" \
  -days 365 \
  -config "$CONFIG_FILE"

rm -f "$CONFIG_FILE"
chmod 600 "$CERT_DIR/key.pem"

echo ""
echo "✔ Certificado generado en: $CERT_DIR"
echo "  - key.pem  (clave privada, mantenla fuera de git)"
echo "  - cert.pem (certificado publico, autofirmado, valido para 'localhost')"
echo ""
echo "El navegador mostrara una advertencia de 'certificado no confiable' la"
echo "primera vez que entres a https://localhost:4000 -> es normal en un"
echo "certificado autofirmado. Acepta/continua para pruebas locales."
