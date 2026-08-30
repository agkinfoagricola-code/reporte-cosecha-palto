Copia aquí tu carpeta `api/` real (ej. `create-user.js`) desde tu repo actual —
no me la compartiste, así que no la puedo recrear. El resto del proyecto no depende
de su contenido interno, solo espera que exista `/api/create-user` como endpoint
(ver `js/auth.js`, función `createUser`).

## Cambio pendiente en tu `create-user.js` real (por el nombre completo)

`js/auth.js` ahora envía dos campos nuevos en el body del POST: `nombres` y `apellidos`
(además de `email` y `password` que ya mandaba). Tu endpoint necesita:

1. Leerlos del body: `const { email, password, nombres, apellidos } = req.body;`
2. Pasarlos como `user_metadata` al crear el usuario en Supabase Auth, para que el
   trigger `handle_new_user()` (ya actualizado en `supabase_setup.sql`, sección 1) los
   copie automáticamente a la tabla `profiles`:

```js
const { data, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { nombres, apellidos },
});
```

Si tu endpoint actual no pasaba `user_metadata`, agrégalo — es la única línea que cambia.
No hace falta tocar nada más del endpoint (roles, confirmación, etc. siguen igual).
