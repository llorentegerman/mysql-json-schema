## mysql-json-schema

*Read it in [English](README.md).*

Con este módulo usted podrá extraer el schema de una base de datos MySql en formato JSON, incluyendo las relaciones entre tablas.
Es posible tambien extraer relaciones por 'convención de nombres'.

## Instalación

npm install mysql-json-schema --save-dev

## API
**Lista de parametros:**

- **user**: database user `required`
- **password**: database password `required`
- **host**: database host `required`
- **database**: database name `required`
- **outputFolder**: la ruta de una carpeta para ubicar los archivos exportados `required`
- **discoverRelations**: defaut: false, si se setea en true, las relaciones seran buscadas por **aliases** o 'convención de nombres', como `<prefix><tableName>` or `<tableName><sufix>`, donde por defecto prefix = *'id_'* y sufix = *'_id'*. Por ejemplo: `phones.contact_id` generará una relación desde la tabla `phones` a traves del campo `contact_id` hacia la llave (`id`) de la tabla `contact`.
- **extractRelations**: default: true, extrae las relaciones que hayan sido definidas en MySql.
- **aliases**: default: [], son necesarios cuando existen casos especificos de relacion mediante nombres de campos que no cumplen con la 'convención de nombres', por ejemplo: [{localTable: 'phones', localField: '**phone_type**', foreignTable: 'phone_types', foreignField: 'id'}], si el campo `phone_type` se hubiera llamado `phone_types_id` se hubiera cumplido la 'convención de nombres'.
- **ignoreDefaultNames**: default: false, debe ser seteado en true si se desea **discoverRelations** solo por *aliases*, sin tener en cuenta *prefix* o *sufix*.
- **prefix**: default: 'id_ ', es el prefijo para una potencial foreign key, por ejemplo: <prefix><tableName>, si prefix = 'id_', y tableName = 'table1' entonces id_table1 sera mapeado como una foreign key, que apunta desde la tabla a la que pertenece este campo, hacia la tabla <tableName>.
- **sufix**: default: '_id', es el sufijo para una potencial foreign key, por ejemplo: <tableName><sufix>, si sufix = '_id', y tableName = 'table1' entonces table1_id sera mapeado como una foreign key, que apunta desde la tabla a la que pertenece este campo, hacia la tabla <tableName>.


----------


| Método | Descripción |
| --------- | ----------- |
| CreateConnection({ host, user, password, database }) | Crea una conexión a la base de datos (no olvides cerrarla). |
| CreateConnectionAsync({ host, user, password, database }) | Crea una conexión a la base de datos y retorna una promesa. (no olvides cerrarla). |
| GetSchema(connection) | Retorna un esquema sin relaciones. |
| GetSchemaWithRelations(connection) | Retorna un esquema con sus relaciones. |
| GetSchemaWithRelationsByFieldNames(connection, aliases, ignoreDefaultNames, prefix, sufix) | Retorna un esquema con sus relaciones buscadas a partir de los nombres de los campos. |
| GetTableList(connection) | Retorna una lista con las tablas de la base de datos. |
| GetFieldsFromTable(connection, tableName) | Retorna una lista con los campos una tabla especifica. |
| GetRelationsFromTable(connection, tableName) | Retorna una lista con las relaciones desde una tabla especifica hacia otras. |
| GetRelationsToTable(connection, tableName) | Retorna una lista con las relaciones donde otras tablas apuntan a una especifica. |
| GetRelationsFromTableByFieldNames({ tableName, schema, aliases, ignoreDefaultNames, prefix, sufix }) | Busca relaciones donde una tabla apunta a otras, y lo hace en función de los nombres de los campos. |
| GetRelationsToTableByFieldNames({ tableName, schema, aliases, ignoreDefaultNames, prefix, sufix }) | Busca relaciones donde una tabla es apuntada por otras, y lo hace en función de los nombres de los campos. |
| ExportSchemaToFiles(args) | Exporta un schema en archivos separados (uno por tabla, no es necesario crear la conexión, se crea internamente). |
| ExportSchemaToFile(args) | Exporta un schema en un único archivo (no es necesario crear la conexión, se crea internamente). |

### Code Example

Aqui hay un [ejemplo](examples/contacts.schema.json) de un esquema que fue exportado en formato JSON.
Y aqui el [sql script](examples/contacts.sql) utilizado para crear el esquema anterior.

Nuestro esquema tiene tres tablas,
`contacts` <--- (*contact_id*) --- `phones` --- (*phone_type*) ---> `phone_types`
Chequear nuestro [sql script](examples/contacts.sql) para mas detalles.

Un breve ejemplo para exportar un esquema en una carpeta especificada por parámetro.
```
import mysql from 'mysql-json-schema';
mysql.ExportSchemaToFiles({
    user: 'root',
    password: 'root',
    host: 'localhost',
    database: 'yourdb',
    outputFolder: 'some folder'
});
```
----------

Un ejemplo sobre como extraer un esquema, y como trabajar con el. No olvidar que debemos cerrar la conexión una vez que terminamos de utilizarla:
```
import mysql from 'mysql-json-schema';
const connection = mysql.CreateConnection({
    user: 'root',
    password: 'root',
    host: 'localhost',
    database: 'yourdb'
});
connection.connect();
mysql.GetSchemaWithRelations(connection)
    .then((schema) => {
        connection.end(); /* After using the connection, it must be closed. */
        const tableNames = Object.keys(schema.tables);
		tableNames.forEach(function (tableName) {
			const table = schema.tables[tableName];
			table.fields.forEach(function (field) {
				field.Field; // Field name
				field.Type; // Field type, ej: int(11)
				field.Null; // is nullable? ej: false
				field.Key; // ej: PRI
				field.Default; // default value
				field.Extra; // extra, ej: auto_increment
			});
			
			// Relations:
			table.relationsFromTable.forEach(function (relation) {
				relation.localField;
				relation.foreignTable;
				relation.foreignField;
			});
			
			table.relationsToTable.forEach(function (relation) {
				relation.localField;
				relation.foreignTable;
				relation.foreignField;
			});
		});
    });
```

----------


Búsqueda avanzada de relaciones, mediante nombres de los campos:
```
import lodash from 'lodash';
import mysql from 'mysql-json-schema';
const args = {
    user: 'root',
    password: 'root',
    host: 'localhost',
    database: 'yourdb',
    outputFolder: 'somefolder',
    discoverRelations: true,
    extractRelations: false,
    aliases: [{localTable: 'phones', localField: 'phone_type', foreignTable: 'phone_types', foreignField: 'id'}],
    ignoreDefaultNames: false,
    prefix: 'id_',
    sufix: '_id'
};

mysql.ExportSchemaToFile(args); // if you want to export the schema directly to a file

// if you want to manipulate the schema
const connection = mysql.CreateConnection(args);
connection.connect();
mysql.GetSchema(connection)
    .then((schema) => {
        connection.end(); // close the connection
        const { discoverRelations, extractRelations, aliases, ignoreDefaultNames, prefix, sufix } = args;

        const aliasesFromThisTable = lodash.filter(aliases, (a) => a.localTable === 'phones'); // only need aliases from this table
        const relationsFrom = mysql.GetRelationsFromTableByFieldNames('phones', schema, aliasesFromThisTable, ignoreDefaultNames, prefix, sufix);
        console.log('Relations From phones');
        console.log(JSON.stringify(relationsFrom, null, 4));

        const aliasesToThisTable = lodash.filter(aliases, (a) => a.foreignTable === 'contacts'); // only need aliases to this table
        console.log('Relations To contacts');
        const relationsTo = mysql.GetRelationsToTableByFieldNames('contacts', schema, aliasesToThisTable, ignoreDefaultNames, prefix, sufix);
        console.log(JSON.stringify(relationsTo, null, 4));
    });
```

Resultado esperado:
```
Relations From phones
[
    {
        "localField": "contacts_id",
        "foreignTable": "contacts",
        "foreignField": "id"
    },
    {
        "localField": "phone_type",
        "foreignTable": "phone_types",
        "foreignField": "id"
    }
]
Relations To contacts
[
    {
        "localField": "id",
        "foreignTable": "phones",
        "foreignField": "contacts_id"
    }
]
```

----------

Test
-------
npm test

License
-------
This software is released under the [MIT License](https://github.com/okunishinishi/node-mysqlspec/blob/master/LICENSE).
