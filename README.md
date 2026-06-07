# Nexus Accounting PR v0.8.4

Corrección de Firebase DEV.

## Qué corrige
- Botón Probar conexión Firebase.
- Autenticación anónima DEV con mensaje claro si no está activa.
- Crea `ownerUid` en `companies/{companyId}`.
- Crea primero `companies/{companyId}/users/{uid}` antes de guardar subcolecciones.
- Reglas Firestore corregidas para owner/admin.
- Storage bucket actualizado para `firebasestorage.app`.

## Pasos mínimos en Firebase Console
1. Authentication → Sign-in method → activar Anonymous para desarrollo.
2. Firestore Database → crear base de datos.
3. Rules → pegar el archivo `firestore.rules` incluido.
4. Storage → crear bucket si vas a subir documentos luego.
5. Abrir `index.html`, ir a Firebase DEV, guardar config, probar conexión, sincronizar empresa.


## v0.8.4 hotfix
- Corrige error Firebase duplicate-app usando app nombrada `nexus-accounting-dev`.
- Limpia valores pegados con comillas, comas o punto y coma desde Firebase Console.
- Permite cambiar configuración DEV sin chocar con otra app Firebase cargada en la página.


## v0.8.4
- Corrige error auth/api-key-not-valid limpiando comillas curvas, comas y etiquetas copiadas desde Firebase Console.
- Valida que API Key empiece con AIza antes de sincronizar.
- Mantiene app Firebase nombrada para evitar duplicate-app.


## Fix v0.8.4
- Corrige error Firestore: logoData mayor a 1 MiB.
- El logo ya no se guarda dentro del documento principal de company.
- Intenta subir el logo a Firebase Storage y guarda la referencia.
- Si Storage no está listo, sincroniza la empresa y deja el logo como local-only.
