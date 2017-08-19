## mysql-json-schema

*Leer en [Español](README.es.md).*

With this module, you can extract the schema of a MySql database in JSON format, including the relations between tables.
It is also possible to extract relations by 'naming convention'.

## Installation

npm install mysql-json-schema --save-dev

## API
**List of arguments:**

- **user**: database user `required`
- **password**: database password `required`
- **host**: database host `required`
- **database**: database name `required`
- **outputFolder**: ouput folder for generated files `required`
- **discoverRelations**: defaut: false, if set this as true, the relations will be looked for by **aliases** or 'naming convention' like `<prefix><tableName>` or `<tableName><sufix>`, where by default prefix = *'id_'* and sufix = *'_id'*. Ie: `phones.contact_id` will be generate a relation from `phones` table by the `contact_id` field to the key field of `contact` table.
- **extractRelations**: default: true, extract relations that are defined in MySql.
- **aliases**: default: [], are necessaries when you have some specific cases of names for the fields that are related, ie: [{localTable: 'phones', localField: '**phone_type**', foreignTable: 'phone_types', foreignField: 'id'}],
- **ignoreDefaultNames**: default: false, you should set it in true if you want to **discoverRelations** only by *aliases*, not using *prefix* or *sufix*
- **prefix**: default: 'id_ ', prefix for foreign key, ie: <prefix><tableName>, if prefix = 'id_', and tableName = 'table1' then id_table1 will be mapped as a foreign key.
- **sufix**: default: '_id', sufix for foreign key, ie: <tableName><sufix>, if sufix = '_id', and tableName = 'table1' then table1_id will be mapped as a foreign key.


----------


| Signature | Description |
| --------- | ----------- |
| CreateConnection({ host, user, password, database }) | Creates a connection to a database (don't forget to close it). |
| CreateConnectionAsync({ host, user, password, database }) | Creates a connection to a database and returns a promise (don't forget to close it). |
| GetSchema(connection) | Returns schema without relations. |
| GetSchemaWithRelations(connection) | Returns schema with relations. |
| GetSchemaWithRelationsByFieldNames(connection, aliases, ignoreDefaultNames, prefix, sufix) | Returns schema with relations by field names. |
| GetTableList(connection) | Returns the database's tables list. |
| GetFieldsFromTable(connection, tableName) | Returns the field list from a table. |
| GetRelationsFromTable(connection, tableName) | Returns the relations from a specific table pointing to others. |
| GetRelationsToTable(connection, tableName) | Returns the relations from other tables pointing to specific one. |
| GetRelationsFromTableByFieldNames({ tableName, schema, aliases, ignoreDefaultNames, prefix, sufix }) | Look for the relationships where a table points to other tables. |
| GetRelationsToTableByFieldNames({ tableName, schema, aliases, ignoreDefaultNames, prefix, sufix }) | Look for relationships where the tables are pointing to a specific one. |
| ExportSchemaToFiles(args) | Exports a schema to outputPath on separate files(No connection required). |
| ExportSchemaToFile(args) | Exports a schema to outputFolder on a file(No connection required). |

### Code Example

Here an [example](examples/contacts.schema.json) of an exported schema in JSON format.
And here an [sql script](examples/contacts.sql) to create that schema.

Our schema has three tables,
`contacts` <--- (*contact_id*) --- `phones` --- (*phone_type*) ---> `phone_types`
please check the [sql script](examples/contacts.sql) for details.

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


Advanced look for relations, by field name:
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

expected output:
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
