import mysql from 'mysql';
import fs from 'fs';

const GetSchema = (connection) => {
    const schema = {type: 'mysql', tables: {}};

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
                                            schema.tables[tableName] = { fields: [], relationsFromTable: {}, relationsToTable: {} };
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
    return mysql.createConnection({ user, password, host, database, multipleStatements });
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
                                schema.tables[tableName] = { fields: [], relationsFromTable: {}, relationsToTable: {} };
                            }
                            
                            schema.tables[tableName].relationsFromTable = relationsFromTable;
                            return GetRelationsToTable(connection, tableName)
                                .then((relationsToTable) => {
                                    schema.tables[tableName].relationsToTable = relationsToTable;
                                });
                        })
                );
            });
            Promise.all(promises).then(() => resolve(schema))
                .catch((err) => reject(err));
        })
    );
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
}

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

const ExportSchemaToFiles = (args = {}) => {
    const connection = CreateConnection(args);
    connection.connect();

    GetSchemaWithRelations(connection)
        .then(res => {
            connection.end();
            const tables = res.tables;
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

    GetSchemaWithRelations(connection)
        .then(res => {
            connection.end();
            const tables = res.tables;
            CreateFileWithContent(`${args.database}.schema`, tables, args.outputFolder);
        })
        .catch((err) => {
            console.error(err);
            connection.end();
        });
}

module.exports = {
    CreateConnection,
    GetSchema, // Returns schema without relations
    GetSchemaWithRelations, // Returns schema with relations
    GetTableList, // Returns the database's tables list
    GetFieldsFromTable, // Returns the field list from a table
    GetRelationsFromTable, // Returns the relations from a specific table pointing to others
    GetRelationsToTable, // Returns the relations from other tables pointing to specific one
    ExportSchemaToFiles, // Creates an schema and export that to outputPath on separate files
    ExportSchemaToFile, // Creates an schema and export that to outputPath on a file
};




