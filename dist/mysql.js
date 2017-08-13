'use strict';

var _mysql = require('mysql');

var _mysql2 = _interopRequireDefault(_mysql);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var GetSchema = function GetSchema(connection) {
    var schema = { type: 'mysql', tables: {} };

    return new Promise(function (resolve, reject) {
        GetTableList(connection, connection.config.database).then(function (tableNames) {

            var promises = [];
            tableNames.forEach(function (tableName, index, array) {
                promises.push(GetFieldsFromTable(connection, tableName).then(function (fields) {
                    fields.forEach(function (field, index, array) {
                        if (!schema.tables[tableName]) {
                            schema.tables[tableName] = { fields: [], relationsFromTable: {}, relationsToTable: {} };
                        }
                        schema.tables[tableName].fields.push(field);
                    });
                }));
            });
            Promise.all(promises).then(function () {
                return resolve(schema);
            });
        }).catch(function (err) {
            return reject(err);
        });
    });
};

var GetTableList = function GetTableList(connection) {
    var tables = [];
    var sqlTables = ' SELECT * FROM information_schema.tables where table_schema = \'' + connection.config.database + '\' ';
    return new Promise(function (resolve, reject) {
        connection.query(sqlTables, function (err, respTables) {
            if (err) {
                reject(err);
            }
            respTables.forEach(function (value, index, array) {
                tables.push(value.TABLE_NAME);
            });
            resolve(tables);
        });
    });
};

var GetFieldsFromTable = function GetFieldsFromTable(connection, table) {
    var fields = [];
    return new Promise(function (resolve, reject) {
        connection.query('desc ' + table, function (err, rows) {
            if (err) {
                reject(err);
            }
            rows.forEach(function (value, index, array) {
                var Field = value.Field,
                    Type = value.Type,
                    Null = value.Null,
                    Key = value.Key,
                    Default = value.Default,
                    Extra = value.Extra; // Extract info

                fields.push({ Field: Field, Type: Type, Null: Null === 'YES', Key: Key, Default: Default, Extra: Extra });
            });
            resolve(fields);
        });
    });
};

var CreateConnection = function CreateConnection() {
    var args = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var user = args.user,
        password = args.password,
        host = args.host,
        database = args.database,
        _args$multipleStateme = args.multipleStatements,
        multipleStatements = _args$multipleStateme === undefined ? true : _args$multipleStateme;

    return _mysql2.default.createConnection({ user: user, password: password, host: host, database: database, multipleStatements: multipleStatements });
};

var AddRelationsToSchema = function AddRelationsToSchema(connection, schema) {
    return new Promise(function (resolve, reject) {

        var promises = [];
        var tableNames = Object.keys(schema.tables);
        tableNames.forEach(function (tableName, index, array) {
            promises.push(GetRelationsFromTable(connection, tableName).then(function (relationsFromTable) {
                if (!schema.tables[tableName]) {
                    schema.tables[tableName] = { fields: [], relationsFromTable: {}, relationsToTable: {} };
                }

                schema.tables[tableName].relationsFromTable = relationsFromTable;
                return GetRelationsToTable(connection, tableName).then(function (relationsToTable) {
                    schema.tables[tableName].relationsToTable = relationsToTable;
                });
            }));
        });
        Promise.all(promises).then(function () {
            return resolve(schema);
        }).catch(function (err) {
            return reject(err);
        });
    });
};

var GetRelationsFromTable = function GetRelationsFromTable(connection, table) {
    var sqlRelaciones = ' SELECT  TABLE_SCHEMA as db, \n     TABLE_NAME as t1,\n     COLUMN_NAME as t1Field,\n      REFERENCED_TABLE_SCHEMA as db2,\n      REFERENCED_TABLE_NAME as t2,\n      REFERENCED_COLUMN_NAME as t2Field \n    FROM \n      INFORMATION_SCHEMA.KEY_COLUMN_USAGE \n    WHERE \n      TABLE_SCHEMA = SCHEMA()\n      AND REFERENCED_TABLE_NAME IS NOT NULL \n     and (TABLE_NAME = \'' + table + '\');'; // and (REFERENCED_TABLE_NAME = '${table}');`

    var relations = [];
    return new Promise(function (resolve, reject) {
        connection.query(sqlRelaciones, function (err, relationsResp) {
            if (err) {
                reject(err);
            }
            relationsResp.forEach(function (value, index, array) {
                var db = value.db,
                    t1 = value.t1,
                    t1Field = value.t1Field,
                    db2 = value.db2,
                    t2 = value.t2,
                    t2Field = value.t2Field; // Extract info

                relations.push({ localField: t1Field, foreignTable: t2, foreignField: t2Field });
            });
            resolve(relations);
        });
    });
};

var GetRelationsToTable = function GetRelationsToTable(connection, table) {
    var sqlRelaciones = ' SELECT  TABLE_SCHEMA as db, \n     TABLE_NAME as t1,\n     COLUMN_NAME as t1Field,\n      REFERENCED_TABLE_SCHEMA as db2,\n      REFERENCED_TABLE_NAME as t2,\n      REFERENCED_COLUMN_NAME as t2Field \n    FROM \n      INFORMATION_SCHEMA.KEY_COLUMN_USAGE \n    WHERE \n      TABLE_SCHEMA = SCHEMA()\n      AND REFERENCED_TABLE_NAME IS NOT NULL \n     and (REFERENCED_TABLE_NAME = \'' + table + '\');';

    var relations = [];
    return new Promise(function (resolve, reject) {
        connection.query(sqlRelaciones, function (err, relationsResp) {
            if (err) {
                reject(err);
            }
            relationsResp.forEach(function (value, index, array) {
                var db = value.db,
                    t1 = value.t1,
                    t1Field = value.t1Field,
                    db2 = value.db2,
                    t2 = value.t2,
                    t2Field = value.t2Field; // Extract info

                relations.push({ localField: t2Field, foreignTable: t1, foreignField: t1Field });
            });
            resolve(relations);
        });
    });
};

var CreateFileWithContent = function CreateFileWithContent(fileName, content, outputFolder) {
    var logger = _fs2.default.createWriteStream(outputFolder + '/' + fileName + '.json', {
        flags: 'w' // 'a' means appending (old data will be preserved)
    });
    logger.write(JSON.stringify(content, null, 4));
    logger.end();
};

var GetSchemaWithRelations = function GetSchemaWithRelations(connection) {
    return GetSchema(connection).then(function (res) {
        return AddRelationsToSchema(connection, res);
    }).catch(function (err) {
        console.error(err);
        throw err;
    });
};

var ExportSchemaToFiles = function ExportSchemaToFiles() {
    var args = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var connection = CreateConnection(args);
    connection.connect();

    GetSchemaWithRelations(connection).then(function (res) {
        connection.end();
        var tables = res.tables;
        var tableNames = Object.keys(tables);
        tableNames.forEach(function (tableName, index, array) {
            CreateFileWithContent(tableName, tables[tableName], args.outputFolder);
        });
    }).catch(function (err) {
        console.error(err);
        connection.end();
    });
};

var ExportSchemaToFile = function ExportSchemaToFile() {
    var args = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var connection = CreateConnection(args);
    connection.connect();

    GetSchemaWithRelations(connection).then(function (res) {
        connection.end();
        var tables = res.tables;
        CreateFileWithContent(args.database + '.schema', tables, args.outputFolder);
    }).catch(function (err) {
        console.error(err);
        connection.end();
    });
};

module.exports = {
    CreateConnection: CreateConnection,
    GetSchema: GetSchema, // Returns schema without relations
    GetSchemaWithRelations: GetSchemaWithRelations, // Returns schema with relations
    GetTableList: GetTableList, // Returns the database's tables list
    GetFieldsFromTable: GetFieldsFromTable, // Returns the field list from a table
    GetRelationsFromTable: GetRelationsFromTable, // Returns the relations from a specific table pointing to others
    GetRelationsToTable: GetRelationsToTable, // Returns the relations from other tables pointing to specific one
    ExportSchemaToFiles: ExportSchemaToFiles, // Creates an schema and export that to outputPath on separate files
    ExportSchemaToFile: ExportSchemaToFile // Creates an schema and export that to outputPath on a file
};