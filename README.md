# Nexus Accounting PR v0.8.1

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


## v0.8.2 hotfix
- Corrige error Firebase duplicate-app usando app nombrada `nexus-accounting-dev`.
- Limpia valores pegados con comillas, comas o punto y coma desde Firebase Console.
- Permite cambiar configuración DEV sin chocar con otra app Firebase cargada en la página.
