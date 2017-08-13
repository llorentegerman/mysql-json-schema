## mysql-json-schema

*Read it in [English](README.md).*

Con este módulo usted podrá extraer el schema de una base de datos MySql en formato JSON, incluyendo las relaciones entre tablas.

## Instalación

npm install mysql-json-schema --save-dev

## API

| Método | Descripción |
| --------- | ----------- |
| CreateConnection({ host, user, password, database }) | Crea una conexión a la base de datos (no olvides cerrarla). |
| GetSchema(connection) | Retorna un esquema sin relaciones. |
| GetSchemaWithRelations(connection) | Retorna un esquema con sus relaciones. |
| GetTableList(connection) | Retorna una lista con las tablas de la base de datos. |
| GetFieldsFromTable(connection, tableName) | Retorna una lista con los campos una tabla especifica. |
| GetRelationsFromTable(connection, tableName) | Retorna una lista con las relaciones desde una tabla especifica hacia otras. |
| GetRelationsToTable(connection, tableName) | Retorna una lista con las relaciones donde otras tablas apuntan a una especifica. |
| ExportSchemaToFiles({ host, user, password, database, outputFolder }) | Exporta un schema en archivos separados (uno por tabla, no es necesario crear la conexión, se crea internamente). |
| ExportSchemaToFile({ host, user, password, database, outputFolder }) | Exporta un schema en un único archivo (no es necesario crear la conexión, se crea internamente). |

### Code Example

Aqui hay un [ejemplo](examples/contacts.schema.json) de un esquema que fue exportado en formato JSON.
Y aqui el [sql script](examples/contacts.sql) utilizado para crear el esquema anterior.

Un breve ejemplo para exportar un esquema en una carpeta especificada por parámetro.
```
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
const connection = mysql.CreateConnection({
    user: 'root',
    password: 'root',
    host: 'localhost',
    database: 'yourdb'
});
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


License
-------
This software is released under the [MIT License](https://github.com/okunishinishi/node-mysqlspec/blob/master/LICENSE).

