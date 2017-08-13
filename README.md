## mysql-json-schema

*Leer en [Español](README.es.md).*

With this module, you can extract the schema of a MySql database in JSON format, including the relations between tables.

## Installation

npm install mysql-json-schema --save-dev

## API

| Signature | Description |
| --------- | ----------- |
| CreateConnection({ host, user, password, database }) | Create a connection to a database (don't forget to close it). |
| GetSchema(connection) | Returns schema without relations. |
| GetSchemaWithRelations(connection) | Returns schema with relations. |
| GetTableList(connection) | Returns the database's tables list. |
| GetFieldsFromTable(connection, tableName) | Returns the field list from a table. |
| GetRelationsFromTable(connection, tableName) | Returns the relations from a specific table pointing to others. |
| GetRelationsToTable(connection, tableName) | Returns the relations from other tables pointing to specific one. |
| ExportSchemaToFiles({ host, user, password, database, outputFolder }) | Exports a schema to outputPath on separate files(No connection required). |
| ExportSchemaToFile({ host, user, password, database, outputFolder }) | Exports a schema to outputFolder on a file(No connection required). |

### Code Example

Here an [example](examples/contacts.schema.json) of an exported schema in JSON format.
And here an [sql script](examples/contacts.sql) to create that schema.

A quick example to export the schema to some folder.
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

How to work with the JSON schema:
```
import mysql from 'mysql-json-schema';
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
