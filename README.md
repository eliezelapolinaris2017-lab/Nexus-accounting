# Nexus Accounting PR v0.3

Portal web local de contabilidad profesional.

## Incluye

- Login demo
- Dashboard contable
- Catálogo de cuentas
- Libro Diario
- Libro Mayor
- Facturación con IVU
- Cobros con doble partida
- Gastos con doble partida
- Bancos
- Reconciliaciones bancarias automáticas y manuales
- Carga de estados de cuenta en CSV
- Auto-match por fecha y monto
- Partidas bancarias manuales
- Ajustes automáticos de reconciliación
- Impuestos
- Estados financieros básicos
- Exportación JSON

## Reconciliaciones

El módulo permite:

1. Subir estado de cuenta en CSV.
2. Leer columnas en español o inglés: fecha/date, descripción/description, referencia/ref, débito/debit, crédito/credit, monto/amount.
3. Ejecutar auto reconciliación por monto y fecha cercana.
4. Reconciliar manualmente marcando movimientos.
5. Registrar partidas manuales del estado bancario.
6. Comparar balance banco vs movimientos marcados.
7. Crear ajustes por cargos bancarios o intereses no registrados.
8. Cerrar reconciliación con historial.

## Uso

Abrir `index.html` en el navegador.

Demo:

- Email: admin@nexuspr.com
- Password: admin123

Los datos se guardan en `localStorage` del navegador.
