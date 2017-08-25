'use strict';

var _mysql = require('mysql');

var _mysql2 = _interopRequireDefault(_mysql);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

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
                            schema.tables[tableName] = { fields: [], relationsFromTable: [], relationsToTable: [] };
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

    var connection = _mysql2.default.createConnection({ user: user, password: password, host: host, database: database, multipleStatements: multipleStatements });
    return connection;
};

var CreateConnectionAsync = function CreateConnectionAsync() {
    var args = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var connection = CreateConnection(args);
    return new Promise(function (resolve, reject) {
        connection.connect(function (err) {
            if (err) {
                return reject(err);
            }
            resolve(connection);
        });
    });
};

var AddRelationsToSchema = function AddRelationsToSchema(connection, schema) {
    return new Promise(function (resolve, reject) {

        var promises = [];
        var tableNames = Object.keys(schema.tables);
        tableNames.forEach(function (tableName, index, array) {
            promises.push(GetRelationsFromTable(connection, tableName).then(function (relationsFromTable) {
                if (!schema.tables[tableName]) {
                    schema.tables[tableName] = { fields: [], relationsFromTable: [], relationsToTable: [] };
                }

                schema.tables[tableName].relationsFromTable = schema.tables[tableName].relationsFromTable.concat(relationsFromTable);
                relationsFromTable.forEach(function (relation) {
                    var fieldFKIndex = _lodash2.default.findIndex(schema.tables[tableName].fields, function (f) {
                        return f.Field === relation.localField;
                    });
                    if (fieldFKIndex >= 0) {
                        schema.tables[tableName].fields[fieldFKIndex].isForeignKey = true;
                    }
                });

                return GetRelationsToTable(connection, tableName).then(function (relationsToTable) {
                    schema.tables[tableName].relationsToTable = schema.tables[tableName].relationsToTable.concat(relationsToTable);
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

var AddRelationsByFieldNameToSchema = function AddRelationsByFieldNameToSchema(schema) {
    var aliases = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var ignoreDefaultNames = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var prefix = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'id_';
    var sufix = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : '_id';

    var tableNames = Object.keys(schema.tables);
    tableNames.forEach(function (tableName, index, array) {
        var aliasesFromThisTable = _lodash2.default.filter(aliases, function (a) {
            return a.localTable === tableName;
        });
        var aliasesToThisTable = _lodash2.default.filter(aliases, function (a) {
            return a.foreignTable === tableName;
        });
        GetRelationsFromTableByFieldNames(tableName, schema, aliasesFromThisTable, ignoreDefaultNames, prefix, sufix);
        GetRelationsToTableByFieldNames(tableName, schema, aliasesToThisTable, ignoreDefaultNames, prefix, sufix);
    });
    return schema;
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

var GetSchemaWithRelationsByFieldNames = function GetSchemaWithRelationsByFieldNames(connection) {
    var aliases = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    var ignoreDefaultNames = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var prefix = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 'id_';
    var sufix = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : '_id';

    return GetSchema(connection).then(function (schema) {
        return AddRelationsByFieldNameToSchema(schema, aliases, ignoreDefaultNames, prefix, sufix);
    }).catch(function (err) {
        console.error(err);
        throw err;
    });
};

var ExportSchemaToFiles = function ExportSchemaToFiles() {
    var args = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    var connection = CreateConnection(args);
    connection.connect();
    return GetSchema(connection).then(function (schema) {
        var _args$extractRelation = args.extractRelations,
            extractRelations = _args$extractRelation === undefined ? true : _args$extractRelation,
            _args$discoverRelatio = args.discoverRelations,
            discoverRelations = _args$discoverRelatio === undefined ? false : _args$discoverRelatio,
            _args$aliases = args.aliases,
            aliases = _args$aliases === undefined ? [] : _args$aliases,
            _args$ignoreDefaultNa = args.ignoreDefaultNames,
            ignoreDefaultNames = _args$ignoreDefaultNa === undefined ? false : _args$ignoreDefaultNa,
            _args$prefix = args.prefix,
            prefix = _args$prefix === undefined ? 'id_' : _args$prefix,
            _args$sufix = args.sufix,
            sufix = _args$sufix === undefined ? '_id' : _args$sufix;

        if (args.discoverRelations) {
            schema = AddRelationsByFieldNameToSchema(schema, aliases, ignoreDefaultNames, prefix, sufix);
        }

        if (args.extractRelations) {
            return AddRelationsToSchema(connection, schema).then(function (res) {
                connection.end();
                var tables = res.tables;
                var tableNames = Object.keys(tables);
                tableNames.forEach(function (tableName, index, array) {
                    CreateFileWithContent(tableName, tables[tableName], args.outputFolder);
                });
            });
        }

        connection.end();
        var tables = schema.tables;
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

    return GetSchema(connection).then(function (schema) {
        var _args$extractRelation2 = args.extractRelations,
            extractRelations = _args$extractRelation2 === undefined ? true : _args$extractRelation2,
            _args$discoverRelatio2 = args.discoverRelations,
            discoverRelations = _args$discoverRelatio2 === undefined ? false : _args$discoverRelatio2,
            _args$aliases2 = args.aliases,
            aliases = _args$aliases2 === undefined ? [] : _args$aliases2,
            _args$ignoreDefaultNa2 = args.ignoreDefaultNames,
            ignoreDefaultNames = _args$ignoreDefaultNa2 === undefined ? false : _args$ignoreDefaultNa2,
            _args$prefix2 = args.prefix,
            prefix = _args$prefix2 === undefined ? 'id_' : _args$prefix2,
            _args$sufix2 = args.sufix,
            sufix = _args$sufix2 === undefined ? '_id' : _args$sufix2;

        if (args.discoverRelations) {
            schema = AddRelationsByFieldNameToSchema(schema, aliases, ignoreDefaultNames, prefix, sufix);
        }

        if (args.extractRelations) {
            return AddRelationsToSchema(connection, schema).then(function (res) {
                connection.end();
                var tables = res.tables;
                CreateFileWithContent(args.database + '.schema', tables, args.outputFolder);
            });
        }

        connection.end();
        var tables = schema.tables;
        CreateFileWithContent(args.database + '.schema', tables, args.outputFolder);
    }).catch(function (err) {
        console.error(err);
        connection.end();
    });
};

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
var GetRelationsFromTableByFieldNames = function GetRelationsFromTableByFieldNames(tableName, schema) {
    var aliases = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    var ignoreDefaultNames = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var prefix = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'id_';
    var sufix = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : '_id';

    var relations = schema.tables[tableName].relationsFromTable || [];
    var tableNames = Object.keys(schema.tables);

    // Create the possibles names of a foreing keys
    var possibleForeignKeysNames = [];
    !ignoreDefaultNames && tableNames.forEach(function (currTableName, index, array) {

        var fields = schema.tables[currTableName].fields;
        var keys = _lodash2.default.filter(fields, function (f) {
            return f.Key === "PRI";
        });
        var key = keys.length > 0 ? keys[0].Field : 'id';

        possibleForeignKeysNames.push({
            tableName: currTableName,
            localField: ('' + currTableName + sufix).toUpperCase(),
            foreignField: key
        });
        possibleForeignKeysNames.push({
            tableName: currTableName,
            localField: ('' + prefix + currTableName).toUpperCase(),
            foreignField: key
        });
    });

    var fields = schema.tables[tableName].fields;
    !ignoreDefaultNames && fields.forEach(function (field) {
        // For each field of the current table
        var fieldUpper = field.Field.toUpperCase();
        var possible = _lodash2.default.findIndex(possibleForeignKeysNames, function (p) {
            return p.localField === fieldUpper;
        });
        if (possible >= 0) {
            // If exists some foreign key
            var relationExists = _lodash2.default.findIndex(relations, function (p) {
                return p.localField === field.Field && p.foreignTable === possibleForeignKeysNames[possible].tableName && p.foreignField === possibleForeignKeysNames[possible].foreignField;
            });

            if (relationExists < 0) {
                relations.push({
                    localField: field.Field,
                    foreignTable: possibleForeignKeysNames[possible].tableName,
                    foreignField: possibleForeignKeysNames[possible].foreignField
                });
                field.isForeignKey = true;
            }
            var inverseRelationExists = _lodash2.default.findIndex(schema.tables[possibleForeignKeysNames[possible].tableName].relationsToTable, function (p) {
                return p.localField === possibleForeignKeysNames[possible].foreignField && p.foreignTable === tableName && p.foreignField === field.Field;
            });
            inverseRelationExists < 0 && schema.tables[possibleForeignKeysNames[possible].tableName].relationsToTable.push({
                localField: possibleForeignKeysNames[possible].foreignField,
                foreignTable: tableName,
                foreignField: field.Field
            });
        }
    });

    aliases.forEach(function (alias, index, array) {
        // check if the relation exists
        var relationExists = _lodash2.default.findIndex(relations, function (r) {
            return r.localField === alias.localField && r.foreignTable === alias.foreignTable && r.foreignField === alias.foreignField;
        });
        if (relationExists < 0) {
            relations.push({
                localField: alias.localField,
                foreignTable: alias.foreignTable,
                foreignField: alias.foreignField
            });
            var fieldFKIndex = _lodash2.default.findIndex(schema.tables[tableName].fields, function (f) {
                return f.Field === alias.localField;
            });
            if (fieldFKIndex >= 0) {
                schema.tables[tableName].fields[fieldFKIndex].isForeignKey = true;
            }
        }
        var inverseRelationExists = _lodash2.default.findIndex(schema.tables[alias.foreignTable].relationsToTable, function (p) {
            return p.localField === alias.foreignField && p.foreignTable === alias.localTable && p.foreignField === alias.localField;
        });
        inverseRelationExists < 0 && schema.tables[alias.foreignTable].relationsToTable.push({
            localField: alias.foreignField,
            foreignTable: alias.localTable,
            foreignField: alias.localField
        });
    });

    return relations;
};

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
var GetRelationsToTableByFieldNames = function GetRelationsToTableByFieldNames(tableName, schema) {
    var aliases = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    var ignoreDefaultNames = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var prefix = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 'id_';
    var sufix = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : '_id';

    var relations = schema.tables[tableName].relationsToTable || [];

    var keys = _lodash2.default.filter(schema.tables[tableName].fields, function (f) {
        return f.Key === "PRI";
    });
    var key = keys.length > 0 ? keys[0].Field : 'id';

    //possibles names of a potential foreignKey that is pointing to this table
    var possibleForeignKeysNames = [('' + tableName + sufix).toUpperCase(), ('' + prefix + tableName).toUpperCase()];

    var tableNames = Object.keys(schema.tables);
    !ignoreDefaultNames && tableNames.forEach(function (currTableName, index, array) {
        // for each table, looking for foreign keys

        var fields = schema.tables[currTableName].fields; // fields of the foreign table
        var possible1 = _lodash2.default.findIndex(fields, function (f) {
            return f.Field.toUpperCase() === possibleForeignKeysNames[0];
        });
        var possible2 = _lodash2.default.findIndex(fields, function (f) {
            return f.Field.toUpperCase() === possibleForeignKeysNames[1];
        });
        if (possible1 >= 0 || possible2 >= 0) {
            var possible = possible1 >= 0 ? possible1 : possible2;
            var relationExists = _lodash2.default.findIndex(relations, function (p) {
                return p.localField === key && p.foreignTable === currTableName && p.foreignField === fields[possible].Field;
            });

            relationExists < 0 && relations.push({ localField: key, foreignTable: currTableName, foreignField: fields[possible].Field });

            var inverseRelationExists = _lodash2.default.findIndex(schema.tables[currTableName].relationsFromTable, function (p) {
                return p.localField === fields[possible].Field && p.foreignTable === tableName && p.foreignField === key;
            });
            if (inverseRelationExists < 0) {
                schema.tables[currTableName].relationsFromTable.push({
                    localField: fields[possible].Field,
                    foreignTable: tableName,
                    foreignField: key
                });
                var fieldFKIndex = _lodash2.default.findIndex(schema.tables[currTableName].fields, function (f) {
                    return f.Field === possible;
                });
                if (fieldFKIndex >= 0) {
                    schema.tables[currTableName].fields[fieldFKIndex].isForeignKey = true;
                }
            }
        }
    });

    aliases.forEach(function (alias, index, array) {
        // check if the relation exists
        var relationExists = _lodash2.default.findIndex(relations, function (r) {
            return r.localField === alias.foreignField && r.foreignTable === alias.localTable && r.foreignField === alias.localField;
        });
        relationExists < 0 && relations.push({
            localField: alias.foreignField,
            foreignTable: alias.localTable,
            foreignField: alias.localField
        });

        var inverseRelationExists = _lodash2.default.findIndex(schema.tables[alias.localTable].relationsFromTable, function (p) {
            return p.localField === alias.localField && p.foreignTable === alias.foreignTable && p.foreignField === alias.foreignField;
        });
        if (inverseRelationExists < 0) {
            schema.tables[alias.localTable].relationsFromTable.push({
                localField: alias.localField,
                foreignTable: alias.foreignTable,
                foreignField: alias.foreignField
            });
            var fieldFKIndex = _lodash2.default.findIndex(schema.tables[alias.localTable].fields, function (f) {
                return f.Field === alias.localField;
            });
            if (fieldFKIndex >= 0) {
                schema.tables[alias.localTable].fields[fieldFKIndex].isForeignKey = true;
            }
        }
    });
    return relations;
};

module.exports = {
    CreateConnection: CreateConnection,
    CreateConnectionAsync: CreateConnectionAsync,
    GetSchema: GetSchema, // Returns schema without relations
    GetSchemaWithRelations: GetSchemaWithRelations, // Returns schema with relations
    GetSchemaWithRelationsByFieldNames: GetSchemaWithRelationsByFieldNames, // Returns schema with relations by field names.
    GetTableList: GetTableList, // Returns the database's tables list
    GetFieldsFromTable: GetFieldsFromTable, // Returns the field list from a table
    GetRelationsFromTable: GetRelationsFromTable, // Returns the relations from a specific table pointing to others
    GetRelationsToTable: GetRelationsToTable, // Returns the relations from other tables pointing to specific one
    GetRelationsFromTableByFieldNames: GetRelationsFromTableByFieldNames, // Look for the relationships where a table points to other tables.
    GetRelationsToTableByFieldNames: GetRelationsToTableByFieldNames, // Look for relationships where the tables are pointing to a specific one.
    ExportSchemaToFiles: ExportSchemaToFiles, // Creates an schema and export that to outputPath on separate files
    ExportSchemaToFile: ExportSchemaToFile // Creates an schema and export that to outputPath on a file
};