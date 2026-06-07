# Nexus Accounting PR v0.4

Portal de contabilidad profesional enfocado exclusivamente en contabilidad.

## Nuevo en v0.4

- Bandeja de Importación para estados de cuenta.
- Carga de CSV/TXT bancario.
- Plantilla CSV descargable.
- Reconciliación automática inteligente con score de coincidencia.
- Reconciliación manual por candidato sugerido.
- Panel de candidatos entre libro contable y estado bancario.
- Desvincular partidas conciliadas.
- Cierre de reconciliación con historial.
- Ajustes contables automáticos por diferencias bancarias.

## Flujo recomendado

1. Crear facturas, cobros o gastos.
2. Ir a Bandeja de Importación.
3. Subir CSV del banco.
4. Ejecutar Auto reconciliar.
5. Revisar candidatos sugeridos.
6. Conciliar manualmente lo pendiente.
7. Crear ajuste si hay cargo/interés no registrado.
8. Cerrar reconciliación.

## Formato CSV aceptado

Columnas recomendadas:

```csv
date,description,reference,amount
2026-06-01,DEP CLIENTE DEMO,INV-2026-000001,111.50
2026-06-02,BANK SERVICE FEE,FEE-001,-15.00
```

También reconoce encabezados en español: fecha, descripcion, referencia, monto.

## Demo

Abrir `index.html` en el navegador.

Login demo:

- Email: admin@nexuspr.com
- Password: admin123

Los datos se guardan localmente en el navegador usando localStorage.
