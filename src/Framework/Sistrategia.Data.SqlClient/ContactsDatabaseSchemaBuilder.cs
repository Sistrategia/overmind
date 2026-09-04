// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using Microsoft.Extensions.Logging;
// using Sistrategia.Data;
// using Sistrategia.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

internal class ContactsDatabaseSchemaBuilder : SqlDatabaseSchemaBuilder
{
    public ContactsDatabaseSchemaBuilder(string connectionString, ILogger<Database> logger)
        : base(connectionString, logger) { }

    public override string SchemaName => "contacts";
    public override string SchemaDescription => "Sistrategia.Contacts.SqlClient";
    public override string Version => "6.0.6829.0";

    public override void CreateSchemaObjects() {
        CreateSchemaObject("contacts");
        // // CreateSchemaObject("documents");
        // CreateSchemaObjectIfNotExists("load");
    }

    public override void CreateSchemaTables() {
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.LineOfBusiness.create_line_of_business.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_schema.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_load_schema.sql");

        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_customer_schema.sql");
    }

    public override void CreateSchemaViews() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_view_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_info_view_schema.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_view.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_view.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_view.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_view.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Relationships.create_contact_relationship_view.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Relationships.create_contact_relationship_contact_info_view.sql");

        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_customer_view_schema.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_customer_info_view_schema.sql");
    }

    public override void CreateSchemaFunctions() {
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_update.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_delete.sql");

        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_ensure_address_location_upsert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_update.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_delete.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_get_phone_numbers_only.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_update.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_delete.sql");

        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_update.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_delete.sql");

        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_update_summary.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_import.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_import_2.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contacts_load_import.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contacts_load_import_request.sql");

        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_customer_listing.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_customer_insert.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_customer_update.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_select_customer_info_by_public_key.sql");
    }

    public override void InsertMinimalData() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.insert_minimal_data.sql");
    }

    public override void DropSchemaTypes() {

    }

    public override void DropSchemaFunctions() {

        // DropProcedureIfExists("contacts", "select_customer_info_by_public_key");
        // DropProcedureIfExists("contacts", "customer_listing");
        // DropProcedureIfExists("contacts", "customer_insert");
        // DropProcedureIfExists("contacts", "customer_update");

        // DropProcedureIfExists("contacts", "contacts_load_import_request");
        // DropProcedureIfExists("contacts", "contacts_load_import");
        // DropProcedureIfExists("contacts", "contact_import_2");
        // DropProcedureIfExists("contacts", "contact_import");
        // DropProcedureIfExists("contacts", "contact_update_summary");
        // DropProcedureIfExists("contacts", "phone_delete");
        // DropProcedureIfExists("contacts", "phone_update");
        // DropProcedureIfExists("contacts", "contact_phone_insert");
        // DropProcedureIfExists("contacts", "phone_insert");
        // DropFunctionIfExists("contacts", "get_phone_numbers_only");
        // DropProcedureIfExists("contacts", "email_delete");
        // DropProcedureIfExists("contacts", "email_update");
        // DropProcedureIfExists("contacts", "contact_email_insert");
        // DropProcedureIfExists("contacts", "email_insert");

        // DropProcedureIfExists("contacts", "contact_web_link_delete");
        // DropProcedureIfExists("contacts", "contact_web_link_update");
        // DropProcedureIfExists("contacts", "contact_web_link_insert");

        // DropProcedureIfExists("contacts", "address_delete");
        // DropProcedureIfExists("contacts", "address_update");
        // DropProcedureIfExists("contacts", "contact_address_insert");
        // DropProcedureIfExists("contacts", "address_insert");
        DropProcedureIfExists("contacts", "ensure_address_location_upsert");

        DropProcedureIfExists("contacts", "contact_insert");


    }

    public override void DropSchemaViews() {
        DropViewIfExists("contacts", "customer_info_view");
        DropViewIfExists("contacts", "customer_view");

        DropViewIfExists("contacts", "contact_relationship_contact_info_view");
        DropViewIfExists("contacts", "contact_relationship_view");
        DropViewIfExists("contacts", "contact_web_link_view");
        DropViewIfExists("contacts", "contact_address_view");
        DropViewIfExists("contacts", "contact_email_view");
        DropViewIfExists("contacts", "contact_phone_view");
        DropViewIfExists("contacts", "contact_info_view");
        DropViewIfExists("contacts", "contact_view");
    }

    public override void DropSchemaTables() {

        // DropTableIfExists("documents", "contact_documents");
        // DropTableIfExists("documents", "contact_document_role");

        // DropTableIfExists("documents", "document");
        // DropTableIfExists("documents", "document_type");

        //DropTableIfExists("load", "contact_load");
        //DropTableIfExists("load", "contact_load_batch");
        //DropTableIfExists("contacts", "contact_load");
        //DropTableIfExists("contacts", "contact_load_batch");
        DropTableIfExists("contacts", "contact_relationship");
        DropTableIfExists("contacts", "contact_relationship_type");
        DropTableIfExists("contacts", "contact_web_link");
        DropTableIfExists("contacts", "web_link");
        DropTableIfExists("contacts", "contact_phone_history");
        DropTableIfExists("contacts", "contact_phone");
        DropTableIfExists("contacts", "phone_location");
        DropTableIfExists("contacts", "phone");
        DropTableIfExists("contacts", "contact_address_history");
        DropTableIfExists("contacts", "contact_address");
        DropTableIfExists("contacts", "address_location");
        DropTableIfExists("contacts", "address");
        DropTableIfExists("contacts", "contact_email_history");
        DropTableIfExists("contacts", "contact_email");
        DropTableIfExists("contacts", "email_location");
        DropTableIfExists("contacts", "email");
        DropTableIfExists("contacts", "contact_person_name");
        DropTableIfExists("contacts", "customer");
        DropTableIfExists("contacts", "contact_history");
        DropTableIfExists("contacts", "contact");
        DropTableIfExists("contacts", "colony");
        DropTableIfExists("contacts", "county");
        DropTableIfExists("contacts", "city");
        DropTableIfExists("contacts", "state");
        DropTableIfExists("contacts", "country");
        DropTableIfExists("contacts", "contact_identifiers");
        DropTableIfExists("contacts", "identifier");
        DropTableIfExists("contacts", "identifier_type");
        DropTableIfExists("contacts", "person_name");
        DropTableIfExists("contacts", "person_name_type_localized");
        DropTableIfExists("contacts", "person_name_type");
        DropTableIfExists("contacts", "contact_type_localized");
        DropTableIfExists("contacts", "contact_type");

        DropTableIfExists("contacts", "line_of_business");
    }

    public override void DropSchemaObjects() {
        // DropSchemaObjectIfExists("documents");
        DropSchemaObjectIfExists("contacts");
    }

    //public override void UpgradeSchema() {
    //    throw new NotImplementedException();
    //}

    //public override void DowngradeSchema() {
    //    throw new NotImplementedException();
    //}

    #region RunLocalStoredCommands

    protected override void RunLocalStoredCommands(string resourceName) {
        SqlDatabase.RunLocalStoredCommands(
            System.Reflection.Assembly.GetExecutingAssembly(), resourceName);
    }

    #endregion
}
