# adapters

Traducen upstream → contrato v1 (`@transportate/contracts`). Funciones puras, testeadas con las fixtures de `test/fixtures/`. Las interfaces (`SubtesAdapter`, `ColectivosAdapter`, `TransitoAdapter`) y `ApiError` están en `types.ts`. Usan los esquemas laxos de `@transportate/contracts/upstream` para leer el upstream.
