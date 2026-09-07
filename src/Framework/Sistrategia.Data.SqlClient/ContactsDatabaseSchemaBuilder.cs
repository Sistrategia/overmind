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
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_profile_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_numbering_schema.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_schema.sql");
        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_load_schema.sql");

        // // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Customers.create_customer_schema.sql");
    }

    public override void CreateSchemaViews() {
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_history_view.sql");
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
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_person_name_value_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_person_name_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_names_replace.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_history_snapshot.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_profile_prepare.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_profile_as_of.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_profile_read_rows.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_change.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Profiles.create_contact_read.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_values_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_history_sync.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_write.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_change.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_insert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_update.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_delete.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_restore.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_move.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_emails_as_of.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_values_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_history_sync.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_write.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_change.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_insert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_update.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_delete.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_restore.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_phone_move.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phones_as_of.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_read_rows.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_read_rows.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_values_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_history_sync.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_write.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_change.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_insert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_update.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_delete.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_restore.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_web_link_move.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_links_as_of.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_read_rows.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.WebLinks.create_contact_web_link_read.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_country_value_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_state_value_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_county_value_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_city_value_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_colony_value_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_geography_resolve.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_ensure_address_location_upsert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_values_ensure.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_country_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_state_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_county_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_city_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_colony_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_location_immutable.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_value_view.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_history_sync.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_write.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_change.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_insert.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_update.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_delete.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_restore.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_address_move.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_addresses_as_of.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_read_rows.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Addresses.create_contact_address_read.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_channels_read_core.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Phones.create_contact_phone_read.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_channels_read.sql");
        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_read.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_contact_email_insert.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_update.sql");
        // RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.Emails.create_email_delete.sql");

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

        RunLocalStoredCommands("Sistrategia.Data.SqlClient.Scripts.Contacts.create_contact_company_lookup.sql");
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
        DropProcedureIfExists("contacts", "person_name_value_ensure");
        DropProcedureIfExists("contacts", "contact_names_replace");
        DropProcedureIfExists("contacts", "contact_history_snapshot");
        DropProcedureIfExists("contacts", "contact_profile_prepare");
        DropProcedureIfExists("contacts", "contact_profile_read_rows");
        DropProcedureIfExists("contacts", "contact_change");
        DropProcedureIfExists("contacts", "contact_read");
        DropFunctionIfExists("contacts", "contact_profile_as_of");
        DropProcedureIfExists("contacts", "contact_address_read");
        DropProcedureIfExists("contacts", "contact_address_read_rows");
        DropFunctionIfExists("contacts", "contact_addresses_as_of");
        DropProcedureIfExists("contacts", "address_move");
        DropProcedureIfExists("contacts", "address_restore");
        DropProcedureIfExists("contacts", "address_delete");
        DropProcedureIfExists("contacts", "address_update");
        DropProcedureIfExists("contacts", "contact_address_insert");
        DropProcedureIfExists("contacts", "contact_address_change");
        DropProcedureIfExists("contacts", "contact_address_write");
        DropProcedureIfExists("contacts", "contact_address_history_sync");
        DropProcedureIfExists("contacts", "address_values_ensure");
        DropProcedureIfExists("contacts", "address_geography_resolve");
        DropProcedureIfExists("contacts", "country_value_ensure");
        DropProcedureIfExists("contacts", "state_value_ensure");
        DropProcedureIfExists("contacts", "county_value_ensure");
        DropProcedureIfExists("contacts", "city_value_ensure");
        DropProcedureIfExists("contacts", "colony_value_ensure");

        DropProcedureIfExists("contacts", "contact_web_link_read");
        DropProcedureIfExists("contacts", "contact_web_link_read_rows");
        DropFunctionIfExists("contacts", "contact_web_links_as_of");
        DropProcedureIfExists("contacts", "web_link_move");
        DropProcedureIfExists("contacts", "web_link_restore");
        DropProcedureIfExists("contacts", "web_link_delete");
        DropProcedureIfExists("contacts", "web_link_update");
        DropProcedureIfExists("contacts", "contact_web_link_insert");
        DropProcedureIfExists("contacts", "contact_web_link_change");
        DropProcedureIfExists("contacts", "contact_web_link_write");
        DropProcedureIfExists("contacts", "contact_web_link_history_sync");
        DropProcedureIfExists("contacts", "web_link_values_ensure");

        DropProcedureIfExists("contacts", "contact_email_read");
        DropProcedureIfExists("contacts", "contact_channels_read");
        DropProcedureIfExists("contacts", "contact_phone_read");
        DropProcedureIfExists("contacts", "contact_channels_read_core");
        DropProcedureIfExists("contacts", "contact_phone_read_rows");
        DropProcedureIfExists("contacts", "contact_email_read_rows");
        DropFunctionIfExists("contacts", "contact_phones_as_of");
        DropProcedureIfExists("contacts", "phone_move");
        DropProcedureIfExists("contacts", "phone_restore");
        DropProcedureIfExists("contacts", "phone_delete");
        DropProcedureIfExists("contacts", "phone_update");
        DropProcedureIfExists("contacts", "contact_phone_insert");
        DropProcedureIfExists("contacts", "contact_phone_change");
        DropProcedureIfExists("contacts", "contact_phone_write");
        DropProcedureIfExists("contacts", "contact_phone_history_sync");
        DropProcedureIfExists("contacts", "phone_values_ensure");
        DropProcedureIfExists("contacts", "email_move");
        DropProcedureIfExists("contacts", "contact_email_history_sync");
        DropProcedureIfExists("contacts", "email_restore");
        DropProcedureIfExists("contacts", "email_delete");
        DropProcedureIfExists("contacts", "email_update");
        DropProcedureIfExists("contacts", "contact_email_insert");
        DropProcedureIfExists("contacts", "contact_email_change");
        DropProcedureIfExists("contacts", "contact_email_write");
        DropProcedureIfExists("contacts", "email_values_ensure");
        DropFunctionIfExists("contacts", "contact_emails_as_of");

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
        DropProcedureIfExists("contacts", "contact_company_lookup");


    }

    public override void DropSchemaViews() {
        DropViewIfExists("contacts", "address_value_view");
        DropViewIfExists("contacts", "contact_email_history_view");
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
        DropTableIfExists("contacts", "contact_web_link_action");
        DropTableIfExists("contacts", "contact_web_link_history");
        DropTableIfExists("contacts", "contact_web_link");
        DropTableIfExists("contacts", "contact_web_link_identity");
        DropTableIfExists("contacts", "web_link_location");
        DropTableIfExists("contacts", "web_link");


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
        DropTableIfExists("contacts", "phone_numbering_area_place");
        DropTableIfExists("contacts", "phone_numbering_area");
        DropTableIfExists("contacts", "contact_phone_action");
        DropTableIfExists("contacts", "contact_phone_history");
        DropTableIfExists("contacts", "contact_phone");
        DropTableIfExists("contacts", "contact_phone_identity");
        DropTableIfExists("contacts", "phone_input");
        DropTableIfExists("contacts", "phone_location");
        DropTableIfExists("contacts", "phone");
        DropTableIfExists("contacts", "contact_address_action");
        DropTableIfExists("contacts", "contact_address_history");
        DropTableIfExists("contacts", "contact_address");
        DropTableIfExists("contacts", "contact_address_identity");
        DropTableIfExists("contacts", "address_location");
        DropTableIfExists("contacts", "address");
        DropTableIfExists("contacts", "contact_email_action");
        DropTableIfExists("contacts", "contact_email_history");
        DropTableIfExists("contacts", "contact_email");
        DropTableIfExists("contacts", "contact_email_identity");
        DropTableIfExists("contacts", "email_location");
        DropTableIfExists("contacts", "email");
        DropTableIfExists("contacts", "contact_profile_action");
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
