"""Independent review probes for ordinary user construction (ADR 0007), 2026-09-05.

Creates its own disposable OvermindAuditTest_<random> databases, loads the same repository scripts and
SQL fixtures as tests/sql/run_dbrow_version_tests.py, then runs review probes. Never targets an
application database; drops only what it created. Probe objects are transaction-local or rolled back.

Probes:
  P1  Duplicate login_name accepted by the constructor (no uniqueness at any scope).
  P2  Promotion silently ignores supplied contact-detail inputs (accept-and-drop).
  P3  Concurrent new-company creations with one name: duplicates under RCSI, then 51313 lockout.
  P4  A company contact (contact_type_id = 2) can be promoted to a user account.
  P5  Promotion followed by a child edit in the same unit shares one revision (positive).
  P6  Three timestamps of one administrative creation with a supplied @created.
  P7  Account phone is never populated by the constructor; user_history records NULL.
  P8  entity_history_snapshot derives op 1/2 only: a hypothetical soft delete is labelled UPDATE.
  P9  Fixture realism: the SQL-fixture System actor has no security.user row.

Usage: python tests/review/user-construction/run_user_construction_probes.py --server localhost
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = ROOT / "src/Framework/Sistrategia.Data.SqlClient/Scripts"
TESTS = ROOT / "tests/sql"

FILES = [
    "Data/create_data_schema.sql", "Entities/create_entities_schema.sql", "Contacts/create_contact_schema.sql",
    "Contacts/Phones/create_phone_schema.sql", "Contacts/Emails/create_email_schema.sql",
    "Contacts/Addresses/create_address_schema.sql", "Security/User/create_security_user_schema.sql",
    "Security/User/create_user_history_schema.sql", "Security/Role/create_security_role_schema.sql",
    "Security/UserRole/create_security_user_role_schema.sql", "Entities/Events/create_events_schema.sql",
    "Data/create_audit_isolation_assert.sql", "Data/create_audit_unit_begin.sql", "Data/create_audit_unit_assert.sql",
    "Data/create_dbrow_version_ensure.sql", "Data/create_tenant_insert.sql", "Data/create_audit_action_next.sql",
    "Entities/create_actor_resolve.sql", "Entities/create_entity_write_lock.sql", "Entities/create_entity_version_bump.sql",
    "Entities/create_entity_history_snapshot.sql", "Contacts/Emails/create_email_values_ensure.sql",
    "Contacts/Emails/create_contact_email_history_sync.sql", "Contacts/Emails/create_contact_email_write.sql",
    "Contacts/Emails/create_contact_email_change.sql", "Contacts/Emails/create_contact_email_insert.sql",
    "Contacts/Emails/create_email_update.sql", "Contacts/Emails/create_email_delete.sql",
    "Contacts/Emails/create_email_restore.sql", "Contacts/Emails/create_email_move.sql",
    "Contacts/Emails/create_contact_emails_as_of.sql", "Contacts/Emails/create_contact_email_read.sql",
    "Contacts/Emails/create_contact_email_history_view.sql", "Entities/create_entity_insert.sql",
    "Contacts/create_contact_insert.sql", "Security/User/create_security_user_insert.sql",
    "Security/User/create_user_history_create.sql", "Security/User/create_system_user_bootstrap.sql",
    "Entities/Events/create_event_create.sql", "Security/create_email_runtime_permissions.sql",
    "Entities/create_entity_view_schema.sql", "Contacts/create_contact_view_schema.sql",
]
FIXTURES = ["dbrow_version_tests.sql", "email_family_tests.sql", "email_order_tests.sql", "user_construction_tests.sql"]
SYSTEM = "71F092F4-3A35-463D-9589-E5EE1373F7D5"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", default="localhost")
    args = parser.parse_args()

    def sql(text, db):
        with tempfile.TemporaryDirectory(prefix="overmind-review-") as tmp:
            path = Path(tmp) / "batch.sql"
            path.write_text(text, encoding="utf-8-sig")
            result = subprocess.run(
                ["sqlcmd", "-S", args.server, "-E", "-C", "-I", "-b", "-l", "10", "-t", "90", "-d", db, "-i", str(path)],
                capture_output=True, text=True)
            if result.returncode:
                raise RuntimeError(result.stdout + result.stderr)
            return result.stdout

    def fixture(db):
        setup = "\nGO\n".join(f"CREATE SCHEMA [{s}];" for s in ["data", "entities", "contacts", "security"])
        setup += "\nGO\n" + "\nGO\n".join((SCRIPTS / f).read_text(encoding="utf-8-sig") for f in FILES)
        sql(setup, db)
        for name in FIXTURES:
            sql((TESTS / name).read_text(encoding="utf-8"), db)

    def new_db():
        name = "OvermindAuditTest_" + uuid.uuid4().hex
        assert re.fullmatch(r"OvermindAuditTest_[0-9a-f]{32}", name)
        return name

    def signal(name):
        return f"EXEC sys.sp_getapplock @Resource=N'{name}', @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0;"

    def wait_signal(name):
        return f"""
DECLARE @deadline_{name} DATETIME2=DATEADD(SECOND,20,SYSUTCDATETIME());
WHILE APPLOCK_TEST('public',N'{name}','Exclusive','Session')=1
BEGIN IF SYSUTCDATETIME()>@deadline_{name} THROW 52000,'rendezvous timeout',1; WAITFOR DELAY '00:00:00.050'; END;"""

    created = []
    try:
        db = new_db()
        sql(f"CREATE DATABASE [{db}];", "master")
        created.append(db)
        print(f"Probing in {db}", flush=True)
        fixture(db)

        # P9 first: what is the SQL-fixture System actor?
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @acct INT=(SELECT COUNT(*) FROM security.[user] WHERE user_id=1), @contact INT=(SELECT COUNT(*) FROM contacts.contact WHERE contact_id=1),
    @type INT=(SELECT entity_type_id FROM entities.entity WHERE entity_id=1);
PRINT 'P9 fixture System: entity_type_id=' + CONVERT(VARCHAR(5),@type) + ' security.user rows=' + CONVERT(VARCHAR(5),@acct)
    + ' contacts.contact rows=' + CONVERT(VARCHAR(5),@contact) + ' (actor_resolve needs only the user type; the real bootstrap creates all three)';
""", db), flush=True)

        # P1 duplicate login
        print(sql(f"""
SET NOCOUNT ON;
EXEC security.user_insert @created_by='{SYSTEM}',@login_name=N'dup-login@example.test',@full_name=N'First holder';
EXEC security.user_insert @created_by='{SYSTEM}',@login_name=N'dup-login@example.test',@full_name=N'Second holder';
DECLARE @n INT=(SELECT COUNT(*) FROM security.[user] WHERE login_name=N'dup-login@example.test');
PRINT 'P1 duplicate login: accounts with the same login_name in one tenant = ' + CONVERT(VARCHAR(5),@n);
""", db), flush=True)

        # P2 promotion ignores contact-detail inputs
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=NEWID(), @id INT, @v BIGINT;
EXEC contacts.contact_insert @public_key=@k,@created_by='{SYSTEM}',@full_name=N'Alpha Original',@email_address=N'alpha@example.test';
SET @id=(SELECT entity_id FROM entities.entity WHERE public_key=@k);
EXEC security.user_insert @public_key=@k,@created_by='{SYSTEM}',@expected_entity_version=1,@login_name=N'alpha-login',
    @full_name=N'Beta Replacement',@person_first_name=N'Beta',@person_job_title=N'Ignored title',
    @phone_number=N'5550001',@numbers_only=N'5550001',@person_company=N'Ghost Company',@dbrow_version=@v OUTPUT;
DECLARE @name NVARCHAR(256)=(SELECT full_name FROM contacts.contact WHERE contact_id=@id),
    @title NVARCHAR(256)=(SELECT person_job_title FROM contacts.contact WHERE contact_id=@id),
    @names INT=(SELECT COUNT(*) FROM contacts.contact_person_name WHERE contact_id=@id),
    @phones INT=(SELECT COUNT(*) FROM contacts.contact_phone WHERE contact_id=@id),
    @rels INT=(SELECT COUNT(*) FROM contacts.contact_relationship WHERE from_contact_id=@id),
    @ghost INT=(SELECT COUNT(*) FROM contacts.contact WHERE full_name=N'Ghost Company');
PRINT 'P2 promotion with supplied contact details: full_name=' + @name + ' job_title=' + ISNULL(@title,'NULL')
    + ' name parts=' + CONVERT(VARCHAR(5),@names) + ' phones=' + CONVERT(VARCHAR(5),@phones)
    + ' relationships=' + CONVERT(VARCHAR(5),@rels) + ' ghost companies created=' + CONVERT(VARCHAR(5),@ghost)
    + ' -> inputs were accepted and dropped without error';
""", db), flush=True)

        # P4 company promotion
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=NEWID(), @err INT=0, @v BIGINT, @r INT;
EXEC contacts.contact_insert @public_key=@k,@created_by='{SYSTEM}',@contact_type_id=2,@full_name=N'Promotable Corp';
BEGIN TRY
    EXEC security.user_insert @public_key=@k,@created_by='{SYSTEM}',@expected_entity_version=1,@login_name=N'corp-login',@full_name=N'Corp',@dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT;
END TRY BEGIN CATCH SET @err=ERROR_NUMBER(); END CATCH;
PRINT 'P4 company (contact_type_id=2) promotion: error=' + CONVERT(VARCHAR(10),@err) + ' (0 = accepted as a user account), resulting revision=' + ISNULL(CONVERT(VARCHAR(5),@r),'NULL');
""", db), flush=True)

        # P5 promotion followed by child edit in the same unit
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=NEWID(), @id INT, @v BIGINT, @r INT, @r2 INT;
EXEC contacts.contact_insert @public_key=@k,@created_by='{SYSTEM}',@full_name=N'Promote then edit',@email_address=N'pte@example.test';
SET @id=(SELECT entity_id FROM entities.entity WHERE public_key=@k);
BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC security.user_insert @public_key=@k,@created_by='{SYSTEM}',@expected_entity_version=1,@login_name=N'pte-login',@full_name=N'x',@dbrow_version=@v OUTPUT,@entity_version=@r OUTPUT;
EXEC contacts.email_update @contact_public_key=@k,@modified_by='{SYSTEM}',@expected_entity_version=1,@ordinal=1,@email_address=N'pte-edited@example.test',@dbrow_version=@v OUTPUT,@entity_version=@r2 OUTPUT;
DECLARE @spine INT=(SELECT COUNT(*) FROM entities.entity_version_history WHERE entity_id=@id AND dbrow_version=@v),
    @hist INT=(SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id AND dbrow_version=@v);
PRINT 'P5 promotion then child edit in one unit: promotion revision=' + CONVERT(VARCHAR(5),@r) + ' email revision=' + CONVERT(VARCHAR(5),@r2)
    + ' spine rows at unit=' + CONVERT(VARCHAR(5),@spine) + ' root history rows at unit=' + CONVERT(VARCHAR(5),@hist) + ' (expect 2, 2, 1, 1)';
ROLLBACK;
""", db), flush=True)

        # P6 timestamps
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=NEWID(), @id INT, @v BIGINT;
EXEC security.user_insert @public_key=@k,@created_by='{SYSTEM}',@login_name=N'ts-login',@full_name=N'Timestamps',@created='2007-06-15 10:00:00',@dbrow_version=@v OUTPUT,@user_id=@id OUTPUT;
DECLARE @ec DATETIME2=(SELECT created FROM entities.entity WHERE entity_id=@id), @em DATETIME2=(SELECT modified FROM entities.entity WHERE entity_id=@id),
    @lm DATETIME2=(SELECT modified FROM data.dbrow_version WHERE dbrow_version=@v), @lr DATETIME2=(SELECT recorded_at FROM data.dbrow_version WHERE dbrow_version=@v),
    @ev DATETIME2=(SELECT created FROM entities.event WHERE subject_id=@id AND dbrow_version=@v);
PRINT 'P6 timestamps for @created=2007-06-15: entity.created=' + CONVERT(VARCHAR(19),@ec,120) + ' entity.modified=' + CONVERT(VARCHAR(19),@em,120)
    + ' ledger.modified=' + CONVERT(VARCHAR(19),@lm,120) + ' ledger.recorded_at=' + CONVERT(VARCHAR(19),@lr,120) + ' event.created=' + CONVERT(VARCHAR(19),@ev,120);
""", db), flush=True)

        # P7 account phone
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=NEWID(), @id INT, @v BIGINT;
EXEC security.user_insert @public_key=@k,@created_by='{SYSTEM}',@login_name=N'phone-login',@full_name=N'Phone user',
    @phone_number=N'328-8894',@phone_area_code=N'777',@numbers_only=N'7773288894',@dbrow_version=@v OUTPUT,@user_id=@id OUTPUT;
DECLARE @acct NVARCHAR(16)=(SELECT phone_number FROM security.[user] WHERE user_id=@id),
    @hist NVARCHAR(16)=(SELECT phone_number FROM security.user_history WHERE user_id=@id),
    @card INT=(SELECT COUNT(*) FROM contacts.contact_phone WHERE contact_id=@id);
PRINT 'P7 account phone: security.user.phone_number=' + ISNULL(@acct,'NULL') + ' user_history.phone_number=' + ISNULL(@hist,'NULL')
    + ' contact_phone rows=' + CONVERT(VARCHAR(5),@card) + ' (constructor phone inputs feed the contact card only)';
""", db), flush=True)

        # P8 snapshot helper op derivation for a hypothetical soft delete (privileged, rolled back)
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=NEWID(), @id INT, @v BIGINT, @r INT, @now DATETIME2=SYSUTCDATETIME();
EXEC contacts.contact_insert @public_key=@k,@created_by='{SYSTEM}',@full_name=N'Snapshot op probe';
SET @id=(SELECT entity_id FROM entities.entity WHERE public_key=@k);
BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC entities.entity_write_lock @id,1,1,@v OUTPUT,@r OUTPUT;
EXEC data.dbrow_version_ensure 1,1,3,@now,@v OUTPUT,@now OUTPUT;   -- business op DELETE
UPDATE entities.entity SET deleted=@now,deleted_by=1 WHERE entity_id=@id;
EXEC entities.entity_version_bump @id,1,1,@v,@now,@r OUTPUT;
EXEC entities.entity_history_snapshot @id,1,@v;
DECLARE @op INT=(SELECT dboperation_type_id FROM entities.entity_history WHERE entity_id=@id AND dbrow_version=@v),
    @del BIT=CASE WHEN EXISTS (SELECT 1 FROM entities.entity_history WHERE entity_id=@id AND dbrow_version=@v AND deleted IS NOT NULL) THEN 1 ELSE 0 END;
PRINT 'P8 snapshot helper used for a soft delete: history dboperation_type_id=' + CONVERT(VARCHAR(5),@op) + ' deleted stamped=' + CONVERT(VARCHAR(1),@del)
    + ' (helper derives 1/2 from revision; a DELETE would need op 3)';
ROLLBACK;
""", db), flush=True)

        # P3 company race: RCSI database (Azure default) so both lookups miss; then the lockout.
        rdb = new_db()
        sql(f"CREATE DATABASE [{rdb}]; ALTER DATABASE [{rdb}] SET READ_COMMITTED_SNAPSHOT ON;", "master")
        created.append(rdb)
        print(f"P3 company race under READ_COMMITTED_SNAPSHOT ON in {rdb}", flush=True)
        fixture(rdb)
        holder = f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC security.user_insert @created_by='{SYSTEM}',@login_name=N'race-a',@full_name=N'Race A',@person_company=N'Race Company';
{signal('race_a_ready')}
{wait_signal('race_b_ready')}
COMMIT;
WAITFOR DELAY '00:00:01';"""
        contender = f"""
SET NOCOUNT ON;
{wait_signal('race_a_ready')}
BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC security.user_insert @created_by='{SYSTEM}',@login_name=N'race-b',@full_name=N'Race B',@person_company=N'Race Company';
{signal('race_b_ready')}
COMMIT;
WAITFOR DELAY '00:00:01';"""
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, holder, rdb), pool.submit(sql, contender, rdb)]
            for job in jobs:
                job.result(timeout=90)
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @companies INT=(SELECT COUNT(*) FROM contacts.contact WHERE full_name=N'Race Company' AND contact_type_id=2), @err INT=0;
BEGIN TRY EXEC security.user_insert @created_by='{SYSTEM}',@login_name=N'race-c',@full_name=N'Race C',@person_company=N'Race Company'; END TRY
BEGIN CATCH SET @err=ERROR_NUMBER(); END CATCH;
PRINT 'P3 concurrent creations with one new company name: companies created=' + CONVERT(VARCHAR(5),@companies)
    + '; next user creation with that name: error ' + CONVERT(VARCHAR(10),@err) + ' (51313 = permanently ambiguous until repaired)';
""", rdb), flush=True)
        # Same schedule without RCSI in the first database, for contrast.
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, holder.replace('race_a_ready', 'rc_a_ready').replace('race_b_ready', 'rc_b_ready').replace("N'race-a'", "N'rc-a'"), db),
                    pool.submit(sql, contender.replace('race_a_ready', 'rc_a_ready').replace('race_b_ready', 'rc_b_ready').replace("N'race-b'", "N'rc-b'"), db)]
            outcomes = []
            for job in jobs:
                try:
                    job.result(timeout=90)
                    outcomes.append("ok")
                except Exception as ex:  # noqa: BLE001 - report the SQL outcome, do not hide it
                    outcomes.append(re.sub(r"\s+", " ", str(ex))[:160])
        print(sql("""
SET NOCOUNT ON;
DECLARE @companies INT=(SELECT COUNT(*) FROM contacts.contact WHERE full_name=N'Race Company' AND contact_type_id=2);
PRINT 'P3b same schedule under plain READ COMMITTED: companies created=' + CONVERT(VARCHAR(5),@companies);
""", db) + "P3b session outcomes: " + " | ".join(outcomes), flush=True)
    finally:
        for name in reversed(created):
            sql(f"ALTER DATABASE [{name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{name}];", "master")
            print(f"Removed {name}", flush=True)


if __name__ == "__main__":
    main()
