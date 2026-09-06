"""Run against an isolated disposable database, never an application database.

Requires Python 3, sqlcmd, .NET 8, and integrated-auth CREATE DATABASE permission.
Usage: python tests/sql/run_dbrow_version_tests.py --server localhost
Actual repository DDL/procedures and the C# email adapter are exercised; unrelated
address/phone/role workflows remain outside this reference suite. No mocks replace SQL.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import subprocess
import tempfile
import uuid
from email_review_regressions import run as run_review_regressions
from user_construction_regressions import run as run_user_regressions

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "src/Framework/Sistrategia.Data.SqlClient/Scripts"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", default="localhost")
    parser.add_argument("--rcsi", action="store_true", help="Run the same complete suite with READ_COMMITTED_SNAPSHOT enabled.")
    args = parser.parse_args()
    database = "OvermindAuditTest_" + uuid.uuid4().hex
    other_database = "OvermindAuditTest_" + uuid.uuid4().hex
    assert re.fullmatch(r"OvermindAuditTest_[0-9a-f]{32}", database)
    assert re.fullmatch(r"OvermindAuditTest_[0-9a-f]{32}", other_database)

    def sql(text, db=database):
        with tempfile.TemporaryDirectory(prefix="overmind-audit-") as tmp:
            path = Path(tmp) / "batch.sql"
            path.write_text(text, encoding="utf-8-sig")
            result = subprocess.run(
                ["sqlcmd", "-S", args.server, "-E", "-C", "-I", "-b", "-l", "10",
                 "-t", "60", "-d", db, "-i", str(path)],
                capture_output=True, text=True,
            )
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)
            return result.stdout

    def signal(name):
        return f"EXEC sys.sp_getapplock @Resource=N'{name}', @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0;"

    def wait_signal(name):
        return f"""
DECLARE @deadline_{name} DATETIME2=DATEADD(SECOND,15,SYSUTCDATETIME());
WHILE APPLOCK_TEST('public',N'{name}','Exclusive','Session')=1
BEGIN
    IF SYSUTCDATETIME()>@deadline_{name} THROW 52000,'Concurrent test rendezvous timed out.',1;
    WAITFOR DELAY '00:00:00.050';
END;
"""

    def concurrent(first, second):
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, command) for command in (first, second)]
            for job in jobs:
                job.result(timeout=45)

    created_databases = []
    try:
        sql(f"CREATE DATABASE [{database}];", "master")
        created_databases.append(database)
        if args.rcsi:
            sql(f"ALTER DATABASE [{database}] SET READ_COMMITTED_SNAPSHOT ON;", "master")
        print(f"Testing in {database}", flush=True)
        files = [
            "Data/create_data_schema.sql",
            "Entities/create_entities_schema.sql",
            "Contacts/create_contact_schema.sql",
            "Contacts/Phones/create_phone_schema.sql",
            "Contacts/Emails/create_email_schema.sql",
            "Contacts/Addresses/create_address_schema.sql",
            "Security/User/create_security_user_schema.sql",
            "Security/User/create_user_history_schema.sql",
            "Security/Role/create_security_role_schema.sql",
            "Security/UserRole/create_security_user_role_schema.sql",
            "Entities/Events/create_events_schema.sql",
            "Data/create_audit_isolation_assert.sql",
            "Data/create_audit_unit_begin.sql",
            "Data/create_audit_unit_assert.sql",
            "Data/create_dbrow_version_ensure.sql",
            "Data/create_tenant_insert.sql",
            "Data/create_audit_action_next.sql",
            "Entities/create_actor_resolve.sql",
            "Entities/create_entity_write_lock.sql",
            "Entities/create_entity_version_bump.sql",
            "Entities/create_entity_history_snapshot.sql",
            "Contacts/Emails/create_email_values_ensure.sql",
            "Contacts/Emails/create_contact_email_history_sync.sql",
            "Contacts/Emails/create_contact_email_write.sql",
            "Contacts/Emails/create_contact_email_change.sql",
            "Contacts/Emails/create_contact_email_insert.sql",
            "Contacts/Emails/create_email_update.sql",
            "Contacts/Emails/create_email_delete.sql",
            "Contacts/Emails/create_email_restore.sql",
            "Contacts/Emails/create_email_move.sql",
            "Contacts/Emails/create_contact_emails_as_of.sql",
            "Contacts/Emails/create_contact_email_read.sql",
            "Contacts/Emails/create_contact_email_history_view.sql",
            "Entities/create_entity_insert.sql",
            "Contacts/create_contact_insert.sql",
            "Security/User/create_security_user_insert.sql",
            "Security/User/create_user_history_create.sql",
            "Security/User/create_system_user_bootstrap.sql",
            "Entities/Events/create_event_create.sql",
            "Security/create_email_runtime_permissions.sql",
            "Entities/create_entity_view_schema.sql",
            "Contacts/create_contact_view_schema.sql",
        ]
        setup = "\nGO\n".join(f"CREATE SCHEMA [{s}];" for s in ["data", "entities", "contacts", "security"])
        setup += "\nGO\n" + "\nGO\n".join((SCRIPTS / f).read_text(encoding="utf-8-sig") for f in files)
        sql(setup)
        print(sql((Path(__file__).with_name("dbrow_version_tests.sql")).read_text()), flush=True)
        print(sql((Path(__file__).with_name("email_family_tests.sql")).read_text(encoding="utf-8")), flush=True)
        print(sql((Path(__file__).with_name("email_order_tests.sql")).read_text(encoding="utf-8")), flush=True)
        print(sql((Path(__file__).with_name("user_construction_tests.sql")).read_text(encoding="utf-8")), flush=True)

        actor = "71F092F4-3A35-463D-9589-E5EE1373F7D5"
        root2 = "E0000000-0000-0000-0000-000000000002"
        root3 = "E0000000-0000-0000-0000-000000000003"
        concurrent(f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.email_update @contact_public_key='{root2}',@modified_by='{actor}',@expected_entity_version=1,@ordinal=1,@email_address=N'winner@example.test';
{signal('email_writer_ready')}
{wait_signal('email_contender_ready')}
COMMIT;
""", f"""
SET NOCOUNT ON;
{wait_signal('email_writer_ready')}
{signal('email_contender_ready')}
EXEC dbo.expect_email_error N'EXEC contacts.email_update @contact_public_key=''{root2}'',@modified_by=''{actor}'',@expected_entity_version=1,@ordinal=1,@email_address=N''loser@example.test'';',51206;
""")
        print("PASS concurrency: same-root stale writer cannot overwrite winner", flush=True)

        concurrent(f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
DECLARE @v BIGINT;
EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT;
{signal('email_low_ready')}
{wait_signal('email_high_done')}
BEGIN TRY
    EXEC contacts.email_update @contact_public_key='{root3}',@modified_by='{actor}',@expected_entity_version=1,@ordinal=1,@email_address=N'out_of_order@example.test',@dbrow_version=@v OUTPUT;
    THROW 52000,'Lower allocation changed a later root.',1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER()<>51204 THROW;
    IF XACT_STATE()<>0 ROLLBACK;
END CATCH;
{signal('email_low_done')}
WAITFOR DELAY '00:00:00.200';
""", f"""
SET NOCOUNT ON;
{wait_signal('email_low_ready')}
EXEC contacts.email_update @contact_public_key='{root3}',@modified_by='{actor}',@expected_entity_version=1,@ordinal=1,@email_address=N'later_commit@example.test';
{signal('email_high_done')}
{wait_signal('email_low_done')}
""")
        print("PASS concurrency: late-root ordering rejects older allocation", flush=True)

        # Concurrent misses for the same exact catalog value, under different root locks.
        concurrent(*[f"""
EXEC contacts.contact_email_insert @contact_public_key='{root}',@created_by='{actor}',@expected_entity_version=2,
    @email_address=N'shared_miss@example.test',@location_name=N'Shared location';
""" for root in (root2, root3)])
        sql("IF (SELECT COUNT(*) FROM contacts.email WHERE email_address=N'shared_miss@example.test')<>1 THROW 52000,'Catalog miss race duplicated a value.',1;")
        # Existing-value lookups must allow the second root to commit while the first remains open.
        concurrent(f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.email_update @contact_public_key='{root2}',@modified_by='{actor}',@expected_entity_version=3,@ordinal=1,@email_address=N'shared_miss@example.test',@location_name=N'Shared location';
{signal('email_hit_ready')}
{wait_signal('email_hit_committed')}
COMMIT;
{signal('email_hit_finished')}
WAITFOR DELAY '00:00:00.200';
""", f"""
SET NOCOUNT ON;
{wait_signal('email_hit_ready')}
EXEC contacts.email_update @contact_public_key='{root3}',@modified_by='{actor}',@expected_entity_version=3,@ordinal=1,@email_address=N'shared_miss@example.test',@location_name=N'Shared location';
{signal('email_hit_committed')}
{wait_signal('email_hit_finished')}
""")
        print("PASS concurrency: catalog misses deduplicate; existing-value hits do not serialize unrelated roots", flush=True)

        # A historical reader must wait even before child mutation/root bump. Otherwise a
        # root S lock can coexist with the writer's U lock, then deadlock on its X upgrade.
        concurrent(f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
DECLARE @root INT=(SELECT entity_id FROM entities.entity WHERE public_key='{root2}'), @v BIGINT, @revision INT;
EXEC entities.entity_write_lock @root,1,4,@v OUTPUT,@revision OUTPUT;
{signal('email_read_guard_ready')}
{wait_signal('email_read_guard_checked')}
COMMIT;
{signal('email_read_guard_finished')}
WAITFOR DELAY '00:00:00.200';
""", f"""
SET NOCOUNT ON; SET LOCK_TIMEOUT 500;
{wait_signal('email_read_guard_ready')}
DECLARE @read_error INT=0;
BEGIN TRY
    EXEC contacts.contact_email_read @contact_public_key='{root2}',@actor='{actor}',@entity_version=4;
END TRY BEGIN CATCH
    SET @read_error=ERROR_NUMBER();
END CATCH;
{signal('email_read_guard_checked')}
{wait_signal('email_read_guard_finished')}
IF @read_error<>1222 THROW 52000,'Historical reader entered between root lock and child mutation.',1;
SET LOCK_TIMEOUT -1;
EXEC contacts.contact_email_read @contact_public_key='{root2}',@actor='{actor}',@entity_version=4;
""")
        print("PASS concurrency: historical reader waits at the initial root lock and succeeds after release", flush=True)

        run_review_regressions(sql, concurrent, signal, wait_signal, actor)
        run_user_regressions(sql, concurrent, signal, wait_signal, actor)

        project = str(ROOT / "tests/EmailReference/EmailReference.csproj")
        subprocess.run(["dotnet", "build", project, "--no-restore", "--nologo", "--verbosity", "quiet"], check=True)
        subprocess.run(["dotnet", "run", "--project", project, "--no-build", "--", args.server, database], check=True)

        # Exercise the actual C# schema-builder bootstrap, including a non-1 default tenant ID.
        sql(f"CREATE DATABASE [{other_database}];", "master")
        created_databases.append(other_database)
        if args.rcsi:
            sql(f"ALTER DATABASE [{other_database}] SET READ_COMMITTED_SNAPSHOT ON;", "master")
        sql(setup, other_database)
        sql("""
INSERT data.dboperation_type VALUES (1,'INSERT'),(2,'UPDATE'),(3,'DELETE');
INSERT contacts.contact_type VALUES (1,'person');
INSERT entities.entity_type VALUES (1,'contact','contacts','contact','contact_view');
INSERT entities.event_type (code_name) VALUES ('contacts.contact.new'),('security.user.new');
INSERT data.tenant (public_key,name) VALUES ('F0000000-0000-0000-0000-000000000001',N'Existing unrelated tenant');
""", other_database)
        subprocess.run(["dotnet", "run", "--project", project, "--no-build", "--", args.server, other_database, "bootstrap"], check=True)
        sql(f"""
IF NOT EXISTS (SELECT 1 FROM entities.entity WHERE entity_id=1 AND entity_type_id=4 AND tenant_id=2 AND is_system=1)
    THROW 52000,'Bootstrap assumed tenant ID 1 or lost the System identity.',1;
IF (SELECT COUNT(*) FROM data.dbrow_version)<>1 THROW 52000,'Bootstrap retry allocated another unit.',1;
EXEC data.tenant_insert @name=N'Another tenant',@actor_entity_id=1;
EXEC contacts.contact_insert @public_key='E0000000-0000-0000-0000-000000000001',@created_by='{actor}',@full_name=N'Bootstrapped contact',@email_address=N'bootstrap@example.test';
IF NOT EXISTS (SELECT 1 FROM contacts.contact_email_history h JOIN entities.entity e ON e.entity_id=h.contact_id WHERE e.tenant_id=2 AND e.entity_version=1)
    THROW 52000,'First email after real bootstrap did not join creation history.',1;
IF (SELECT COUNT(*) FROM data.dbrow_version)<>3 THROW 52000,'Bootstrap/tenant/business allocation diverged.',1;
""", other_database)
        print("PASS bootstrap: reserved System ID, actual tenant ID, repeat safety, shared allocation and first email", flush=True)

        # Same SQL connection/transaction, another database, matching ledger number and engine ID:
        # all hints can match, but that database does not own the original per-version guard.
        sql(f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
DECLARE @v BIGINT;
EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT;
INSERT [{other_database}].data.dbrow_version (tenant_id,dbrow_version,dboperation_type_id,modified,modified_by,allocation_transaction_id)
VALUES (2,@v,2,'20260905',1,CURRENT_TRANSACTION_ID());
EXEC [{other_database}].data.audit_unit_begin;
BEGIN TRY
    EXEC [{other_database}].data.dbrow_version_ensure 2,1,2,'20260905',@v OUTPUT;
    THROW 52000,'Cross-database reuse accepted forged matching hints.',1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER()<>51103 THROW;
    IF XACT_STATE()<>0 ROLLBACK;
END CATCH;
""")
        print("PASS ownership: same connection/engine transaction and matching number cannot authorize cross-database reuse", flush=True)

        # Separate connections allocate simultaneously; sequence gaps are deliberately permitted.
        worker = """
SET NOCOUNT ON;
DECLARE @i INT = 0, @v BIGINT;
WHILE @i < 20
BEGIN
    BEGIN TRANSACTION;
    EXEC data.audit_unit_begin;
    SET @v = NULL;
    EXEC data.dbrow_version_ensure 1, 1, 1, '20010101', @v OUTPUT;
    COMMIT;
    SET @i += 1;
END;
"""
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(lambda _: sql(worker), range(4)))
        sql("""
IF (SELECT COUNT(*) FROM data.dbrow_version WHERE modified = '20010101') <> 80
    THROW 52000, 'Concurrent allocation lost ledger entries.', 1;
IF (SELECT COUNT(DISTINCT dbrow_version) FROM data.dbrow_version WHERE modified = '20010101') <> 80
    THROW 52000, 'Concurrent allocations were not unique.', 1;
""")
        print("PASS: 80 concurrent allocations across four connections", flush=True)

        # Exercise the full application path, not only selected framework scripts/bootstrap.
        cycle_database = "OvermindAuditTest_" + uuid.uuid4().hex
        assert re.fullmatch(r"OvermindAuditTest_[0-9a-f]{32}", cycle_database)
        sql(f"CREATE DATABASE [{cycle_database}];", "master")
        created_databases.append(cycle_database)
        if args.rcsi:
            sql(f"ALTER DATABASE [{cycle_database}] SET READ_COMMITTED_SNAPSHOT ON;", "master")
        subprocess.run(["dotnet", "run", "--project", project, "--no-build", "--",
                        args.server, cycle_database, "schema-cycle"], check=True)
    finally:
        for created_database in reversed(created_databases):
            # Only the generated, validated test name is ever dropped.
            sql(f"ALTER DATABASE [{created_database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{created_database}];", "master")
            print(f"Removed {created_database}", flush=True)


if __name__ == "__main__":
    main()
