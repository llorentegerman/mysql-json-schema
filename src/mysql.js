import mysql from 'mysql';
import fs from 'fs';
import lodash from 'lodash';

const GetSchema = (connection) => {
    const schema = { type: 'mysql', tables: {} };

    return (
        new Promise(function (resolve, reject) {
            GetTableList(connection, connection.config.database)
                .then((tableNames) => {
                    var promises = [];
                    tableNames.forEach((tableName, index, array) => {
                        promises.push(
                            GetFieldsFromTable(connection, tableName)
                                .then((fields) => {
                                    fields.forEach((field, index, array) => {
                                        if (!schema.tables[tableName]) {
                                            schema.tables[tableName] = { fields: [], relationsFromTable: [], relationsToTable: [] };
                                        }
                                        schema.tables[tableName].fields.push(field);
                                    });
                                })
                        );
                    });
                    Promise.all(promises).then(() => resolve(schema));
                })
                .catch((err) => reject(err));
        })
    );
};

const GetTableList = (connection) => {
    const tables = [];
    const sqlTables = ` SELECT * FROM information_schema.tables where table_schema = '${connection.config.database}' `;
    return (
        new Promise(function (resolve, reject) {
            connection.query(sqlTables, function (err, respTables) {
                if (err) {
                    reject(err);
                }
                respTables.forEach((value, index, array) => {
                    tables.push(value.TABLE_NAME);
                });
                resolve(tables);
            });
        })
    );
}

const GetFieldsFromTable = (connection, table) => {
    const fields = [];
    return (
        new Promise(function (resolve, reject) {
            connection.query(`desc ${table}`, function (err, rows) {
                if (err) {
                    reject(err);
                }
                rows.forEach((value, index, array) => {
                    const { Field, Type, Null, Key, Default, Extra } = value; // Extract info
                    fields.push({ Field, Type, Null: (Null === 'YES'), Key, Default, Extra });
                });
                resolve(fields);
            });
        })
    );
}

const CreateConnection = (args = {}) => {
    const { user, password, host, database, multipleStatements = true } = args;
    const connection = mysql.createConnection({ user, password, host, database, multipleStatements });
    return connection;
}

const CreateConnectionAsync = (args = {}) => {
    const connection = CreateConnection(args);
    return (
        new Promise(function (resolve, reject) {
            connection.connect(function (err) {
                if (err) {
                    return reject(err);
                }
                resolve(connection);
            });
        })
    );
}

const AddRelationsToSchema = (connection, schema) => {
    return (
        new Promise(function (resolve, reject) {

            var promises = [];
            const tableNames = Object.keys(schema.tables);
            tableNames.forEach((tableName, index, array) => {
                promises.push(
                    GetRelationsFromTable(connection, tableName)
                        .then((relationsFromTable) => {
                            if (!schema.tables[tableName]) {
                                schema.tables[tableName] = { fields: [], relationsFromTable: [], relationsToTable: [] };
                            }
                            
                            schema.tables[tableName].relationsFromTable = schema.tables[tableName].relationsFromTable.concat(relationsFromTable);
                            relationsFromTable.forEach((relation) => {
                                const fieldFKIndex = lodash.findIndex(schema.tables[tableName].fields, (f) => f.Field === relation.localField);
                                if (fieldFKIndex >= 0) {
                                    schema.tables[tableName].fields[fieldFKIndex].isForeignKey = true;
                                }
                            });
                            
                            return GetRelationsToTable(connection, tableName)
                                .then((relationsToTable) => {
                                    schema.tables[tableName].relationsToTable = schema.tables[tableName].relationsToTable.concat(relationsToTable);
                                });
                        })
                );
            });
            Promise.all(promises).then(() => resolve(schema))
                .catch((err) => reject(err));
        })
    );
};

const AddRelationsByFieldNameToSchema = (schema, aliases = [], ignoreDefaultNames = false, prefix = 'id_', sufix = '_id') => {
    const tableNames = Object.keys(schema.tables);
    tableNames.forEach((tableName, index, array) => {
        const aliasesFromThisTable = lodash.filter(aliases, (a) => a.localTable === tableName);
        const aliasesToThisTable = lodash.filter(aliases, (a) => a.foreignTable === tableName);
        GetRelationsFromTableByFieldNames(tableName, schema, aliasesFromThisTable, ignoreDefaultNames, prefix, sufix);
        GetRelationsToTableByFieldNames(tableName, schema, aliasesToThisTable, ignoreDefaultNames, prefix, sufix);
    });
    return schema;
};

const GetRelationsFromTable = (connection, table) => {
    const sqlRelaciones = ` SELECT  TABLE_SCHEMA as db, 
     TABLE_NAME as t1,
     COLUMN_NAME as t1Field,
      REFERENCED_TABLE_SCHEMA as db2,
      REFERENCED_TABLE_NAME as t2,
      REFERENCED_COLUMN_NAME as t2Field 
    FROM 
      INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE 
      TABLE_SCHEMA = SCHEMA()
      AND REFERENCED_TABLE_NAME IS NOT NULL 
     and (TABLE_NAME = '${table}');` // and (REFERENCED_TABLE_NAME = '${table}');`

    const relations = [];
    return (
        new Promise(function (resolve, reject) {
            connection.query(sqlRelaciones, function (err, relationsResp) {
                if (err) {
                    reject(err);
                }
                relationsResp.forEach((value, index, array) => {
                    const { db, t1, t1Field, db2, t2, t2Field } = value; // Extract info
                    relations.push({ localField: t1Field, foreignTable: t2, foreignField: t2Field });
                });
                resolve(relations);
            });
        })
    );
};

const GetRelationsToTable = (connection, table) => {
    const sqlRelaciones = ` SELECT  TABLE_SCHEMA as db, 
     TABLE_NAME as t1,
     COLUMN_NAME as t1Field,
      REFERENCED_TABLE_SCHEMA as db2,
      REFERENCED_TABLE_NAME as t2,
      REFERENCED_COLUMN_NAME as t2Field 
    FROM 
      INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE 
      TABLE_SCHEMA = SCHEMA()
      AND REFERENCED_TABLE_NAME IS NOT NULL 
     and (REFERENCED_TABLE_NAME = '${table}');`

    const relations = [];
    return (
        new Promise(function (resolve, reject) {
            connection.query(sqlRelaciones, function (err, relationsResp) {
                if (err) {
                    reject(err);
                }
                relationsResp.forEach((value, index, array) => {
                    const { db, t1, t1Field, db2, t2, t2Field } = value; // Extract info
                    relations.push({ localField: t2Field, foreignTable: t1, foreignField: t1Field });
                });
                resolve(relations);
            });
        })
    );
}

const CreateFileWithContent = (fileName, content, outputFolder) => {
    var logger = fs.createWriteStream(`${outputFolder}/${fileName}.json`, {
        flags: 'w' // 'a' means appending (old data will be preserved)
    })
    logger.write(JSON.stringify(content, null, 4));
    logger.end();
}

const GetSchemaWithRelations = (connection) => {
    return GetSchema(connection)
        .then(res => AddRelationsToSchema(connection, res))
        .catch((err) => {
            console.error(err);
            throw err;
        });
}

const GetSchemaWithRelationsByFieldNames = (connection, aliases = [], ignoreDefaultNames = false, prefix = 'id_', sufix = '_id') => {
    return GetSchema(connection)
        .then(schema => AddRelationsByFieldNameToSchema(schema, aliases, ignoreDefaultNames, prefix, sufix))
        .catch((err) => {
            console.error(err);
            throw err;
        });
}

const ExportSchemaToFiles = (args = {}) => {
    const connection = CreateConnection(args);
    connection.connect();
    return GetSchema(connection)
        .then((schema) => {
            const { extractRelations = true, discoverRelations = false, aliases = [], ignoreDefaultNames = false, prefix = 'id_', sufix = '_id' } = args;
            if (args.discoverRelations) {
                schema = AddRelationsByFieldNameToSchema(schema, aliases, ignoreDefaultNames, prefix, sufix);
            }

            if (args.extractRelations) {
                return AddRelationsToSchema(connection, schema)
                    .then(res => {
                        connection.end();
                        const tables = res.tables;
                        const tableNames = Object.keys(tables);
                        tableNames.forEach((tableName, index, array) => {
                            CreateFileWithContent(tableName, tables[tableName], args.outputFolder);
                        });
                    })
            }

            connection.end();
            const tables = schema.tables;
            const tableNames = Object.keys(tables);
            tableNames.forEach((tableName, index, array) => {
                CreateFileWithContent(tableName, tables[tableName], args.outputFolder);
            });
        })
        .catch((err) => {
            console.error(err);
            connection.end();
        });
}

const ExportSchemaToFile = (args = {}) => {
    const connection = CreateConnection(args);
    connection.connect();

    return GetSchema(connection)
        .then((schema) => {
            const { extractRelations = true, discoverRelations = false, aliases = [], ignoreDefaultNames = false, prefix = 'id_', sufix = '_id' } = args;
            if (args.discoverRelations) {
                schema = AddRelationsByFieldNameToSchema(schema, aliases, ignoreDefaultNames, prefix, sufix);
            }

            if (args.extractRelations) {
                return AddRelationsToSchema(connection, schema)
                    .then(res => {
                        connection.end();
                        const tables = res.tables;
                        CreateFileWithContent(`${args.database}.schema`, tables, args.outputFolder);
                    })
            }

            connection.end();
            const tables = schema.tables;
            CreateFileWithContent(`${args.database}.schema`, tables, args.outputFolder);
        })
        .catch((err) => {
            console.error(err);
            connection.end();
        });
}

/**
 * Look for the relationships where a table points to other tables.
 * Check by 'naming convention' like <prefix><tableName> or <tableName><sufix>, where by default prefix = 'id_' and sufix = '_id'.
 * Or check by specific aliases.
 * @param {String} tableName - the name of the table that are pointing to others
 * @param {Object} schema - the current schema
 * @param {Array} aliases - some specifics cases like: [ {localTable: 'table1', localField: 'the_table2_id', foreignTable: 'table2', foreignField: 'id'},
 *                  {localTable: 'table1', localField: 'table_3_id_x', foreignTable: 'table3', foreignField: 'id'}]
 * @param {Boolean} ignoreDefaultNames - if you want ignore the default 'naming convention'
 * @param {String} prefix - prefix for foreign key, ie: <prefix><tableName>, if prefix = 'id_', and tableName = 'table1' then
 *                  id_table1 will be mapped as a foreign key.
 * @param {String} sufix - sufix for foreign key, ie: <tableName><sufix>, if sufix = '_id', and tableName = 'table1' then
 *                  table1_id will be mapped as a foreign key.
 */
const GetRelationsFromTableByFieldNames = (tableName, schema, aliases = [], ignoreDefaultNames = false, prefix = 'id_', sufix = '_id') => {
    const relations = schema.tables[tableName].relationsFromTable || [];
    const tableNames = Object.keys(schema.tables);

    // Create the possibles names of a foreing keys
    const possibleForeignKeysNames = [];
    !ignoreDefaultNames && tableNames.forEach((currTableName, index, array) => {

        const fields = schema.tables[currTableName].fields;
        const keys = lodash.filter(fields, (f) => f.Key === "PRI");
        const key = keys.length > 0 ? keys[0].Field : 'id';

        possibleForeignKeysNames.push({
            tableName: currTableName,
            localField: `${currTableName}${sufix}`.toUpperCase(),
            foreignField: key
        });
        possibleForeignKeysNames.push({
            tableName: currTableName,
            localField: `${prefix}${currTableName}`.toUpperCase(),
            foreignField: key
        });
    });

    const fields = schema.tables[tableName].fields;
    !ignoreDefaultNames && fields.forEach((field) => { // For each field of the current table
        const fieldUpper = field.Field.toUpperCase();
        const possible = lodash.findIndex(possibleForeignKeysNames, (p) => p.localField === fieldUpper);
        if (possible >= 0) { // If exists some foreign key
            const relationExists = lodash.findIndex(relations,
                (p) => p.localField === field.Field &&
                    p.foreignTable === possibleForeignKeysNames[possible].tableName &&
                    p.foreignField === possibleForeignKeysNames[possible].foreignField);

            if (relationExists < 0) {
                relations.push({
                    localField: field.Field,
                    foreignTable: possibleForeignKeysNames[possible].tableName,
                    foreignField: possibleForeignKeysNames[possible].foreignField
                });
                field.isForeignKey = true;
            }
            const inverseRelationExists = lodash.findIndex(schema.tables[possibleForeignKeysNames[possible].tableName].relationsToTable,
                (p) => p.localField === possibleForeignKeysNames[possible].foreignField &&
                    p.foreignTable === tableName &&
                    p.foreignField === field.Field);
            (inverseRelationExists < 0) && schema.tables[possibleForeignKeysNames[possible].tableName].relationsToTable.push({
                localField: possibleForeignKeysNames[possible].foreignField,
                foreignTable: tableName,
                foreignField: field.Field
            });
        }
    });

    aliases.forEach((alias, index, array) => {
        // check if the relation exists
        const relationExists = lodash.findIndex(relations, (r) =>
            r.localField === alias.localField &&
            r.foreignTable === alias.foreignTable &&
            r.foreignField === alias.foreignField);
        if (relationExists < 0) {
            relations.push({
                localField: alias.localField,
                foreignTable: alias.foreignTable,
                foreignField: alias.foreignField
            });
            const fieldFKIndex = lodash.findIndex(schema.tables[tableName].fields, (f) => f.Field === alias.localField);
            if (fieldFKIndex >= 0) {
                schema.tables[tableName].fields[fieldFKIndex].isForeignKey = true;
            }
        }
        const inverseRelationExists = lodash.findIndex(schema.tables[alias.foreignTable].relationsToTable,
            (p) => p.localField === alias.foreignField &&
                p.foreignTable === alias.localTable &&
                p.foreignField === alias.localField);
        (inverseRelationExists < 0) && schema.tables[alias.foreignTable].relationsToTable.push({
            localField: alias.foreignField,
            foreignTable: alias.localTable,
            foreignField: alias.localField
        });
    });

    return relations;
}

/**
 * Look for relationships where the tables are pointing to a specific one.
 * Check by 'naming convention' like <prefix><tableName> or <tableName><sufix>, where by default prefix = 'id_' and sufix = '_id'.
 * Or check by specific aliases.
 * @param {String} tableName - the name of the table that others are pointing
 * @param {Object} schema - the current schema
 * @param {Array} aliases - some specifics cases like: [ {localTable: 'table1', localField: 'id', foreignTable: 'table2', foreignField: 'the_table1_id'},
 *                  {localTable: 'table1', localField: 'id', foreignTable: 'table3', foreignField: 'table_1_id_x'}]
 * @param {Boolean} ignoreDefaultNames - if you want ignore the default 'naming convention'
 * @param {String} prefix - prefix for foreign key, ie: <prefix><tableName>, if prefix = 'id_', and tableName = 'table1' then
 *                  id_table1 will be mapped as a foreign key.
 * @param {String} sufix - sufix for foreign key, ie: <tableName><sufix>, if sufix = '_id', and tableName = 'table1' then
 *                  table1_id will be mapped as a foreign key.
 */
const GetRelationsToTableByFieldNames = (tableName, schema, aliases = [], ignoreDefaultNames = false, prefix = 'id_', sufix = '_id') => {
    const relations = schema.tables[tableName].relationsToTable || [];

    const keys = lodash.filter(schema.tables[tableName].fields, (f) => f.Key === "PRI");
    const key = keys.length > 0 ? keys[0].Field : 'id';

    //possibles names of a potential foreignKey that is pointing to this table
    const possibleForeignKeysNames = [`${tableName}${sufix}`.toUpperCase(), `${prefix}${tableName}`.toUpperCase()];

    const tableNames = Object.keys(schema.tables);
    !ignoreDefaultNames && tableNames.forEach((currTableName, index, array) => { // for each table, looking for foreign keys

        const fields = schema.tables[currTableName].fields; // fields of the foreign table
        const possible1 = lodash.findIndex(fields, (f) => f.Field.toUpperCase() === possibleForeignKeysNames[0]);
        const possible2 = lodash.findIndex(fields, (f) => f.Field.toUpperCase() === possibleForeignKeysNames[1]);
        if (possible1 >= 0 || possible2 >= 0) {
            const possible = (possible1 >= 0) ? possible1 : possible2;
            const relationExists = lodash.findIndex(relations,
                (p) => p.localField === key &&
                    p.foreignTable === currTableName &&
                    p.foreignField === fields[possible].Field);

            (relationExists < 0) && relations.push({ localField: key, foreignTable: currTableName, foreignField: fields[possible].Field });

            const inverseRelationExists = lodash.findIndex(schema.tables[currTableName].relationsFromTable,
                (p) => p.localField === fields[possible].Field &&
                    p.foreignTable === tableName &&
                    p.foreignField === key);
            if (inverseRelationExists < 0) {
                schema.tables[currTableName].relationsFromTable.push({
                    localField: fields[possible].Field,
                    foreignTable: tableName,
                    foreignField: key
                });
                const fieldFKIndex = lodash.findIndex(schema.tables[currTableName].fields, (f) => f.Field === possible);
                if (fieldFKIndex >= 0) {
                    schema.tables[currTableName].fields[fieldFKIndex].isForeignKey = true;
                }
            }
        }
    });

    aliases.forEach((alias, index, array) => {
        // check if the relation exists
        const relationExists = lodash.findIndex(relations, (r) =>
            r.localField === alias.foreignField &&
            r.foreignTable === alias.localTable &&
            r.foreignField === alias.localField);
        (relationExists < 0) && relations.push({
            localField: alias.foreignField,
            foreignTable: alias.localTable,
            foreignField: alias.localField
        });

        const inverseRelationExists = lodash.findIndex(schema.tables[alias.localTable].relationsFromTable,
            (p) => p.localField === alias.localField &&
                p.foreignTable === alias.foreignTable &&
                p.foreignField === alias.foreignField);
        if (inverseRelationExists < 0) {
            schema.tables[alias.localTable].relationsFromTable.push({
                localField: alias.localField,
                foreignTable: alias.foreignTable,
                foreignField: alias.foreignField
            });
            const fieldFKIndex = lodash.findIndex(schema.tables[alias.localTable].fields, (f) => f.Field === alias.localField);
            if (fieldFKIndex >= 0) {
                schema.tables[alias.localTable].fields[fieldFKIndex].isForeignKey = true;
            }
        }
    });
    return relations;
}

module.exports = {
    CreateConnection,
    CreateConnectionAsync,
    GetSchema, // Returns schema without relations
    GetSchemaWithRelations, // Returns schema with relations
    GetSchemaWithRelationsByFieldNames, // Returns schema with relations by field names.
    GetTableList, // Returns the database's tables list
    GetFieldsFromTable, // Returns the field list from a table
    GetRelationsFromTable, // Returns the relations from a specific table pointing to others
    GetRelationsToTable, // Returns the relations from other tables pointing to specific one
    GetRelationsFromTableByFieldNames, // Look for the relationships where a table points to other tables.
    GetRelationsToTableByFieldNames, // Look for relationships where the tables are pointing to a specific one.
    ExportSchemaToFiles, // Creates an schema and export that to outputPath on separate files
    ExportSchemaToFile, // Creates an schema and export that to outputPath on a file
};




