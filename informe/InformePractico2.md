


<p align="center">
  <img src="./imagenes/imagenes/Logo_UCU.png"
<center>


Universidad Católica del Uruguay

Facultad de Ingeniería y Tecnologías

Desarrollo de Software Seguro

Unidad Temática 2

Mitigación de Vulnerabilidades de CWE

<br/>
<br/>




Integrantes:
	•	Enzo Barreto
	•	Guillermo Rivero 
	

Montevideo, Uruguay
24 de septiembre

⸻

# Vulnerabiliades

- [1. Inyección SQL (SQLi)](#inyeccion-sql-sqli)
- [2. Credenciales embebidas (Hard Coded Credentials)](#credenciales-embebidas-hard-coded-credentials)
- [3. Falsificación de Peticiones del Lado del Servidor (SSRF)](#ssrf-falsificacion-de-peticiones-del-lado-del-servidor)
- [4. Recorrido de Directorios (Path Traversal)](#recorrido-de-directorios-path-traversal)
- [5. Falta de Autorización (Missing Authorization)](#falta-de-autorizacion-missing-authorization)
- [6. Inyección de Comandos en Plantillas (Template Command Injection)](#inyeccion-de-comandos-en-plantillas-template-command-injection)
- [7. Almacenamiento Inseguro](#almacenamiento-inseguro)
⸻



Vulnerabilidades detectadas y mitigaciones

<a id="inyeccion-sql-sqli"></a>
## 1. Inyección SQL (SQLi)


Las inyecciones SQL ocurren cuando el input del usuario se concatena directamente en consultas SQL, permitiendo ejecución arbitraria de sentencias.

Archivo y línea afectada
services/backend/src/services/invoiceService.ts — línea aproximada: 19

Código vulnerable:

if (status) q = q.andWhereRaw(" status "+ operator + " '"+ status +"'");

Prueba de concepto
Petición GET:

GET /invoices?status=paid' OR '1'='1&operator==

O simplemente establecer status = "paid' OR '1'='1" y operator = '=' en la query.

Mitigación recomendada
	•	No construir SQL por concatenación con valores del usuario.
	•	Validar y limitar operator a un conjunto permitido (por ejemplo: ['=', '!=']).
	•	Usar parámetros o métodos del query builder (.andWhere) para pasar valores.

Ejemplo de corrección (knex / TypeScript)

const allowedOps = new Set(['=', '!=']);
if (status && allowedOps.has(operator)) {
  q = q.andWhere('status', operator, status);
}

Si el query builder no soporta operator dinámico, mapear a funciones explícitas:

if (status) {
  if (operator === '=') q = q.andWhere('status', status);
  else if (operator === '!=') q = q.andWhereNot('status', status);
}
<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.47.46 p. m..png"
<center>

⸻

<a id="credenciales-embebidas-hard-coded-credentials"></a>
## 2. Credenciales embebidas (Hard Coded Credentials)


Credenciales (usuarios, passwords, tokens, strings de conexión) incluidas en código o seeds que pueden filtrarse si el repositorio se publica.

Archivos detectados
	•	services/backend/seeds/carga_test.js — usuarios de prueba con contraseñas visibles.
	•	services/backend/src/knexfile.ts — configuración de base de datos posiblemente con credenciales.

Riesgo / explotación
Cualquiera que acceda al repositorio o los artefactos con la semilla puede autenticarse en la aplicación con esas credenciales.

Mitigación
	•	Mover credenciales a variables de entorno (process.env.*) y nunca commitear .env.
	•	Para seeds de pruebas, utilizar contraseñas generadas dinámicamente o documentadas como TEST_ONLY y no iguales a credenciales reales.
	•	Usar gestores de secretos (Vault, Azure Key Vault, AWS Secrets Manager) en entornos productivos.

Ejemplo
carga_test.js:

// Antes (vulnerable)
// { username: 'admin', password: 'Admin123' }

// Recomendado: leer desde env al ejecutar el seed
const adminPass = process.env.TEST_ADMIN_PASS || 'local_dev_password_only';
// insertar usuario con adminPass, y documentar que en CI/CD se debe inyectar TEST_ADMIN_PASS

En knexfile.ts, reemplazar valores fijos por process.env.DB_USER, process.env.DB_PASS, process.env.DB_HOST, etc.
<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.27.21 p. m..png"
<center>

Tambien se ve aca:services/backend/src/knexfile.ts
<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.27.57 p. m..png"
<center>
⸻

<a id="ssrf-falsificacion-de-peticiones-del-lado-del-servidor"></a>
## 3. Falsificación de Peticiones del Lado del Servidor (SSRF)


El servidor realiza peticiones HTTP construidas a partir de datos controlados por el usuario, pudiendo alcanzar recursos internos o externos que no deberían.

Archivo y línea afectada
services/backend/src/services/invoiceService.ts — línea aprox. 42

Código vulnerable:

const paymentResponse = await axios.post(`http://${paymentBrand}/payments`, { ccNumber, ccv, expirationDate });

PoC
Si el parámetro paymentBrand viene del usuario, este puede indicar 127.0.0.1:2375 o direcciones internas y enviar datos al servicio interno.

Mitigación
	•	No permitir URLs arbitrarias. Mantener un mapeo interno (allowlist) de proveedores soportados.
	•	Validar paymentBrand contra la allowlist, y usar URL fijas.
	•	Evitar concatenar esquemas/hosts desde input.
	•	Restringir salidas salientes con firewall o egress rules si es posible.

Ejemplo de corrección

const brands: Record<string,string> = {
  visa: 'https://api.visa.com/payments',
  mastercard: 'https://api.mastercard.com/payments',
};
if (!brands[paymentBrand]) throw new Error('Invalid payment brand');
const paymentResponse = await axios.post(brands[paymentBrand], { ccNumber, ccv, expirationDate });

Validación extra: limitar tamaño/payload, timeouts y validar response antes de devolver información al usuario.

También hay riesgo en la carga de imágenes sin validación (ver fileService.ts): validar tipo MIME, extensión, tamaño y usar almacenamiento seguro.

<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.57.00 p. m..png"
<center>
⸻

<a id="recorrido-de-directorios-path-traversal"></a>
## 4. Recorrido de Directorios (Path Traversal)



El usuario puede manipular rutas de archivos para acceder o borrar archivos fuera del directorio previsto.

Archivos afectados
	•	services/backend/src/services/clinicalHistoryService.ts — métodos de borrar/obtener/ID con paths no validados (método comentado).
	•	services/backend/src/controllers/invoiceController.ts — endpoints que reciben pdfs y paths.
	•	services/backend/src/services/fileService.ts — upload sin validaciones.

Mitigación
	•	Normalizar y sanear rutas con path.join(baseDir, path.basename(userPath)) o path.resolve y comprobar que la ruta resultante comience con baseDir.
	•	No confiar en file.path del cliente; usar nombre generado por servidor.
	•	Limitar tipos y tamaños de archivos.

Ejemplo

const safeBase = path.resolve(process.env.STORAGE_DIR || '/data/uploads');
const safePath = path.resolve(safeBase, path.basename(f.path));
if (!safePath.startsWith(safeBase)) throw new Error('Invalid file path');
await unlink(safePath);

Para subir:
	•	Usar multer con fileFilter que valide mimetype y extensión.
	•	Generar nombres únicos en servidor (UUID) y almacenar mapping en DB.

<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.29.13 p. m..png"
<center>
⸻

<a id="falta-de-autorizacion-missing-authorization"></a>
## 5. Falta de Autorización (Missing Authorization)


Endpoints que devuelven recursos (facturas, historiales) sin verificar que el usuario que solicita sea el propietario.

Archivos afectados
	•	services/backend/src/controllers/invoiceController.ts — const invoice = await InvoiceService.getInvoice(invoiceId); (línea ~65) sin chequear invoice.userId contra req.user.id.
	•	services/backend/src/services/InvoiceService.ts — getInvoice y getReceipt no validan propietario.

PoC
Un usuario autenticado podría solicitar /invoices/:id con el id de otra factura y obtenerla.

Mitigación
	•	Siempre obtener recursos filtrando por id y ownerId (usuario autenticado).
	•	En controladores, comprobar if (invoice.userId !== req.user.id) return 403.

Ejemplo de corrección

// controlador
const invoice = await InvoiceService.getInvoice(invoiceId);
if (!invoice || invoice.userId !== req.user.id) {
  return res.status(403).json({ error: 'Forbidden' });
}
res.json(invoice);

// o en service layer
getInvoiceForUser(invoiceId, userId) {
  return db('invoices').where({ id: invoiceId, user_id: userId }).first();
}

<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.27.57 p. m..png"
<center>
⸻

<a id="inyeccion-de-comandos-en-plantillas-template-command-injection"></a>
## 6. Inyección de Comandos en Plantillas (Template Command Injection)

Uso de motores de plantillas (ejs, pug, handlebars) que renderizan input del usuario sin escapar puede llevar a ejecución de código o fugas de información.

Zonas a revisar
	•	services/authService.ts y cualquier ejs.render(template, data) que incluya input sin escapar.

Mitigación
	•	Escapar/encodear todo contenido de usuario antes de inyectarlo en templates.
	•	Usar funciones de escape del motor de templates o librerías de sanitización.
	•	Evitar eval o renderizaciones de templates con contenido interpretado como código.

<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.31.23 p. m..png"
<center>
⸻

<a id="almacenamiento-inseguro"></a>
## 7. Almacenamiento Inseguro
Descripción
Contraseñas y secretos almacenados en texto plano en la DB o ficheros.

Archivo afectado
services/backend/src/services/authService.ts — comparación de password en texto plano:

if (password != user.password) throw new Error('Invalid password');

Riesgo
Si la base de datos se ve comprometida, todas las contraseñas son legibles.

Mitigación
	•	Hash de contraseñas con bcrypt (o Argon2) al crear/actualizar usuario.
	•	Al autenticar, comparar con bcrypt.compareSync o su versión async.

Ejemplo

import bcrypt from 'bcrypt';
// al registrar
const hash = bcrypt.hashSync(plainPassword, 10);
// al login
if (!bcrypt.compareSync(password, user.password)) throw new Error('Invalid password');

<p align="center">
  <img src="./imagenes/Captura de pantalla 2025-09-21 a la(s) 10.33.32 p. m..png"
<center>
⸻

