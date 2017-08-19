import lodash from 'lodash';
import examples from './utilToTest.json';
import mysql from '../src/mysql';

describe("Relations", function () {

    let args;
    let schema;

    beforeEach(function () {
        mysql.GetTableList = jasmine.createSpy().and.returnValue(Promise.resolve(examples.tableList));
        mysql.GetFieldsFromTable = jasmine.createSpy().and.callFake((tableName) => Promise.resolve(examples.fieldList[tableName]));
        mysql.GetRelationsFromTable = jasmine.createSpy().and.callFake((tableName) => Promise.resolve(examples.relations[tableName].from));
        mysql.GetRelationsToTable = jasmine.createSpy().and.callFake((tableName) => Promise.resolve(examples.relations[tableName].to));

        args = {
            database: 'contacts',
            discoverRelations: true,
            extractRelations: false,
            aliases: [{ localTable: 'phones', localField: 'phone_type', foreignTable: 'phone_types', foreignField: 'id' }],
            ignoreDefaultNames: false,
            prefix: 'id_',
            sufix: '_id'
        };

        schema = examples.schemaWithoutRelations;
    });

    describe("Relations of Contacts table", function () {

        const tableName = 'contacts';

        it("Relations of Contacts table, by name and with aliases included", function () {
            schema.tables[tableName].relationsFromTable = []
            schema.tables[tableName].relationsToTable = []

            const aliasesFromThisTable = lodash.filter(args.aliases, (a) => a.localTable === tableName);
            const aliasesToThisTable = lodash.filter(args.aliases, (a) => a.foreignTable === tableName);

            const relationsFrom = mysql.GetRelationsFromTableByFieldNames(tableName, schema, aliasesFromThisTable, args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsFrom).toEqual(examples.relations[tableName].from);

            const relationsTo = mysql.GetRelationsToTableByFieldNames(tableName, schema, aliasesToThisTable, args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsTo).toEqual(examples.relations[tableName].to);
        });

        it("Relations of Contacts table, only by name", function () {
            schema.tables[tableName].relationsFromTable = []
            schema.tables[tableName].relationsToTable = []

            const relationsFrom = mysql.GetRelationsFromTableByFieldNames(tableName, schema, [], args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsFrom).toEqual(examples.relations[tableName].from);

            const relationsTo = mysql.GetRelationsToTableByFieldNames(tableName, schema, [], args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsTo).toEqual(examples.relations[tableName].to);
        });

    });

    describe("Relations of Phone_Types table", function () {

        const tableName = 'phones';

        it("Relations of Phones table, by name and with aliases included", function () {
            schema.tables[tableName].relationsFromTable = []
            schema.tables[tableName].relationsToTable = []

            const aliasesFromThisTable = lodash.filter(args.aliases, (a) => a.localTable === tableName);
            const aliasesToThisTable = lodash.filter(args.aliases, (a) => a.foreignTable === tableName);

            const relationsFrom = mysql.GetRelationsFromTableByFieldNames(tableName, schema, aliasesFromThisTable, args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsFrom).toEqual(examples.relations[tableName].from);

            const relationsTo = mysql.GetRelationsToTableByFieldNames(tableName, schema, aliasesToThisTable, args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsTo).toEqual(examples.relations[tableName].to);
        });

        it("Relations of Phones table, only by name", function () {
            schema.tables[tableName].relationsFromTable = []
            schema.tables[tableName].relationsToTable = []

            const relationsFrom = mysql.GetRelationsFromTableByFieldNames(tableName, schema, [], args.ignoreDefaultNames, args.prefix, args.sufix)
            const relationWithoutAliases = examples.relations[tableName].from.slice(0, 1); // removing { localField: 'phone_type', foreignTable: 'phone_types', foreignField: 'id' }
            expect(relationsFrom).toEqual(relationWithoutAliases);

            const relationsTo = mysql.GetRelationsToTableByFieldNames(tableName, schema, [], args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsTo).toEqual(examples.relations[tableName].to);
        });

    });

    describe("Relations of Phone_Types table", function () {

        const tableName = 'phone_types';

        it("Relations of Phone_Types table, by name and with aliases included", function () {
            schema.tables[tableName].relationsFromTable = []
            schema.tables[tableName].relationsToTable = []

            const aliasesFromThisTable = lodash.filter(args.aliases, (a) => a.localTable === tableName);
            const aliasesToThisTable = lodash.filter(args.aliases, (a) => a.foreignTable === tableName);

            const relationsFrom = mysql.GetRelationsFromTableByFieldNames(tableName, schema, aliasesFromThisTable, args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsFrom).toEqual(examples.relations[tableName].from);

            const relationsTo = mysql.GetRelationsToTableByFieldNames(tableName, schema, aliasesToThisTable, args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsTo).toEqual(examples.relations[tableName].to);
        });

        it("Relations of Phone_Types table, only by name", function () {
            schema.tables[tableName].relationsFromTable = []
            schema.tables[tableName].relationsToTable = []

            const relationsFrom = mysql.GetRelationsFromTableByFieldNames(tableName, schema, [], args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsFrom).toEqual(examples.relations[tableName].from);

            const relationsTo = mysql.GetRelationsToTableByFieldNames(tableName, schema, [], args.ignoreDefaultNames, args.prefix, args.sufix)
            expect(relationsFrom).toEqual([]);
        });

    });

});
