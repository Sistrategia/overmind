"""Independent review probes for the email reference family (2026-09-05).

Creates its own disposable OvermindAuditTest_<random> databases, loads the actual repository
DDL/procedures exactly like tests/sql/run_dbrow_version_tests.py, runs the existing SQL fixtures,
then runs review probes. Never targets an application database. Drops only what it created.

Probes:
  A. Guard behaviour across SAVE TRANSACTION / ROLLBACK TO SAVEPOINT (Q1).
  B. Historical reader lock/IO footprint on entities.entity_history and contacts.contact_history,
     which have no root-leading index (Q4/Q9). Adds the candidate indexes in the probe DB only
     and measures again.
  C. Stable child ordinals versus the `ordinal = 1` primary-email convention in contact_view (Q2/Q9).
  D. Same SQL fixtures under READ_COMMITTED_SNAPSHOT ON (Azure SQL Database default) (Q3/Q10).
  E. Opposite-order two-root deadlock: documented retryable 1205, not a template defect (Q4).

Usage: python tests/review/email-reference-family/run_review_probes.py --server localhost
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
    "Entities/Events/create_events_schema.sql", "Data/create_audit_unit_begin.sql", "Data/create_audit_unit_assert.sql",
    "Data/create_dbrow_version_ensure.sql", "Data/create_tenant_insert.sql", "Data/create_audit_action_next.sql",
    "Entities/create_actor_resolve.sql", "Entities/create_entity_write_lock.sql", "Entities/create_entity_version_bump.sql",
    "Contacts/Emails/create_email_values_ensure.sql", "Contacts/Emails/create_contact_email_write.sql",
    "Contacts/Emails/create_contact_email_change.sql", "Contacts/Emails/create_contact_email_insert.sql",
    "Contacts/Emails/create_email_update.sql", "Contacts/Emails/create_email_delete.sql",
    "Contacts/Emails/create_email_restore.sql", "Contacts/Emails/create_contact_emails_as_of.sql",
    "Contacts/Emails/create_contact_email_read.sql", "Contacts/Emails/create_contact_email_history_view.sql",
    "Entities/create_entity_insert.sql", "Contacts/create_contact_insert.sql",
    "Security/User/create_security_user_insert.sql", "Security/User/create_system_user_bootstrap.sql",
    "Entities/Events/create_event_create.sql", "Security/create_email_runtime_permissions.sql",
    # Views the application actually reads; not part of the reference suite's fixture.
    "Entities/create_entity_view_schema.sql", "Contacts/create_contact_view_schema.sql",
]

ACTOR = "71F092F4-3A35-463D-9589-E5EE1373F7D5"


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

    def setup_script():
        setup = "\nGO\n".join(f"CREATE SCHEMA [{s}];" for s in ["data", "entities", "contacts", "security"])
        return setup + "\nGO\n" + "\nGO\n".join((SCRIPTS / f).read_text(encoding="utf-8-sig") for f in FILES)

    def fixture(db):
        sql(setup_script(), db)
        sql((TESTS / "dbrow_version_tests.sql").read_text(), db)
        sql((TESTS / "email_family_tests.sql").read_text(encoding="utf-8"), db)
        # The reference fixture leaves System (id 1) as an entity only; make it a contact/user so the
        # application views (INNER JOIN security.user on modified_by) can be exercised.
        sql("""
IF NOT EXISTS (SELECT 1 FROM contacts.contact WHERE contact_id=1) INSERT contacts.contact (contact_id,contact_type_id,full_name) VALUES (1,1,N'System');
IF NOT EXISTS (SELECT 1 FROM security.[user] WHERE user_id=1) INSERT security.[user] (user_id,login_name) VALUES (1,N'system');
""", db)

    def new_db_name():
        name = "OvermindAuditTest_" + uuid.uuid4().hex
        assert re.fullmatch(r"OvermindAuditTest_[0-9a-f]{32}", name)
        return name

    created = []
    try:
        main_db = new_db_name()
        sql(f"CREATE DATABASE [{main_db}];", "master")
        created.append(main_db)
        print(f"Probing in {main_db}", flush=True)
        fixture(main_db)

        # ---------------------------------------------------------------- A. savepoints
        print(sql("""
SET NOCOUNT ON;
DECLARE @v BIGINT, @before NVARCHAR(32), @after NVARCHAR(32), @unit NVARCHAR(32), @found BIGINT=NULL, @err INT=0, @v2 BIGINT=NULL;
BEGIN TRAN; EXEC data.audit_unit_begin;
SAVE TRAN sp1;
EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT;
SET @before = APPLOCK_MODE('dbo','overmind:version:'+CONVERT(NVARCHAR(20),@v),'Transaction');
ROLLBACK TRAN sp1;
SET @after  = APPLOCK_MODE('dbo','overmind:version:'+CONVERT(NVARCHAR(20),@v),'Transaction');
SET @unit   = APPLOCK_MODE('dbo','overmind:unit:'+CONVERT(NVARCHAR(20),CURRENT_TRANSACTION_ID()),'Transaction');
DECLARE @row_exists BIT = CASE WHEN EXISTS (SELECT 1 FROM data.dbrow_version WHERE dbrow_version=@v) THEN 1 ELSE 0 END;
BEGIN TRY EXEC data.audit_unit_assert @found OUTPUT; END TRY BEGIN CATCH SET @err=ERROR_NUMBER(); END CATCH;
DECLARE @reuse_err INT=0;
BEGIN TRY EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v OUTPUT; END TRY BEGIN CATCH SET @reuse_err=ERROR_NUMBER(); END CATCH;
BEGIN TRY EXEC data.dbrow_version_ensure 1,1,2,'20260905',@v2 OUTPUT; END TRY BEGIN CATCH SET @v2=-ERROR_NUMBER(); END CATCH;
PRINT 'PROBE A savepoint: version lock before rollback-to-savepoint=' + ISNULL(@before,'NULL')
    + ' after=' + ISNULL(@after,'NULL') + ' unit lock=' + ISNULL(@unit,'NULL')
    + ' ledger row exists=' + CONVERT(VARCHAR(1),@row_exists)
    + ' assert(NULL) found=' + ISNULL(CONVERT(VARCHAR(20),@found),'NULL') + ' assert error=' + CONVERT(VARCHAR(10),@err)
    + ' reuse of rolled-back version error=' + CONVERT(VARCHAR(10),@reuse_err)
    + ' fresh NULL allocation after savepoint rollback=' + ISNULL(CONVERT(VARCHAR(20),@v2),'NULL');
ROLLBACK;
""", main_db), flush=True)

        # ---------------------------------------------------------------- B. reader footprint
        sql(f"""
SET NOCOUNT ON;
DECLARE @i INT=0, @k UNIQUEIDENTIFIER;
WHILE @i < 300
BEGIN
    SET @k = NEWID();
    EXEC contacts.contact_insert @public_key=@k, @created_by='{ACTOR}', @full_name=N'Footprint contact',
        @email_address=N'footprint@example.test', @supress_event_message=1;
    IF @i = 0 UPDATE entities.entity SET logical_key=N'footprint-first' WHERE public_key=@k;
    SET @i += 1;
END;
""", main_db)
        sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=(SELECT public_key FROM entities.entity WHERE logical_key=N'footprint-first');
DECLARE @ver INT=(SELECT entity_version FROM entities.entity WHERE public_key=@k);
EXEC contacts.email_update @contact_public_key=@k,@modified_by='{ACTOR}',@expected_entity_version=@ver,@ordinal=1,@email_address=N'footprint-later@example.test';
""", main_db)
        footprint = """
SET NOCOUNT ON;
DECLARE @c INT=(SELECT entity_id FROM entities.entity WHERE logical_key=N'footprint-first');
DECLARE @bound BIGINT=(SELECT MAX(dbrow_version) FROM entities.entity_version_history WHERE entity_id=@c);
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN TRAN;
-- Same statements the reader executes for the historical root payload.
DECLARE @x INT;
SELECT TOP(1) @x=[entity_id] FROM [entities].[entity_history] WHERE [entity_id]=@c AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC;
SELECT TOP(1) @x=[contact_id] FROM [contacts].[contact_history] WHERE [contact_id]=@c AND [dbrow_version]<=@bound ORDER BY [dbrow_version] DESC;
SELECT o.name AS table_name, l.resource_type, COUNT(*) AS locks_held
FROM sys.dm_tran_locks l JOIN sys.partitions p ON p.hobt_id=l.resource_associated_entity_id
JOIN sys.objects o ON o.object_id=p.object_id
WHERE l.request_session_id=@@SPID AND o.name IN ('entity_history','contact_history') AND l.resource_type IN ('KEY','PAGE','OBJECT')
GROUP BY o.name, l.resource_type ORDER BY o.name, l.resource_type;
COMMIT;
"""
        print("PROBE B1 reader footprint WITHOUT root-leading history indexes (300 roots, target = oldest root):", flush=True)
        print(sql(footprint, main_db), flush=True)
        sql("""
CREATE INDEX ix_review_entity_history_root ON entities.entity_history (entity_id, dbrow_version DESC);
CREATE INDEX ix_review_contact_history_root ON contacts.contact_history (contact_id, dbrow_version DESC);
""", main_db)
        print("PROBE B2 same statements WITH (entity_id, dbrow_version DESC) / (contact_id, dbrow_version DESC):", flush=True)
        print(sql(footprint, main_db), flush=True)

        # ---------------------------------------------------------------- C. ordinal = 1 convention
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @k UNIQUEIDENTIFIER=NEWID(), @o INT, @ver INT;
EXEC contacts.contact_insert @public_key=@k, @created_by='{ACTOR}', @full_name=N'Primary convention',
    @email_address=N'first-primary@example.test', @supress_event_message=1;
SET @ver=(SELECT entity_version FROM entities.entity WHERE public_key=@k);
EXEC contacts.email_delete @contact_public_key=@k,@modified_by='{ACTOR}',@expected_entity_version=@ver,@ordinal=1;
SET @ver=(SELECT entity_version FROM entities.entity WHERE public_key=@k);
EXEC contacts.contact_email_insert @contact_public_key=@k,@created_by='{ACTOR}',@expected_entity_version=@ver,
    @email_address=N'replacement@example.test',@ordinal=@o OUTPUT;
DECLARE @live INT=(SELECT COUNT(*) FROM contacts.contact_email WHERE contact_id=(SELECT entity_id FROM entities.entity WHERE public_key=@k));
DECLARE @view_email NVARCHAR(256)=(SELECT email_address FROM contacts.contact_view WHERE public_key=@k);
PRINT 'PROBE C primary convention: live email rows=' + CONVERT(VARCHAR(5),@live) + ' new ordinal=' + CONVERT(VARCHAR(5),@o)
    + ' contact_view.email_address=' + ISNULL(@view_email,'NULL');
""", main_db), flush=True)

        # ---------------------------------------------------------------- E. opposite-order deadlock
        root2 = "E0000000-0000-0000-0000-000000000002"
        root3 = "E0000000-0000-0000-0000-000000000003"
        versions = sql(f"""
SET NOCOUNT ON;
DECLARE @v2 INT=(SELECT entity_version FROM entities.entity WHERE public_key='{root2}');
DECLARE @v3 INT=(SELECT entity_version FROM entities.entity WHERE public_key='{root3}');
PRINT 'V2=' + CONVERT(VARCHAR(10),@v2);
PRINT 'V3=' + CONVERT(VARCHAR(10),@v3);
""", main_db)
        v2 = re.search(r"V2=(\d+)", versions).group(1)
        v3 = re.search(r"V3=(\d+)", versions).group(1)

        def signal(name):
            return f"EXEC sys.sp_getapplock @Resource=N'{name}', @LockMode='Exclusive', @LockOwner='Session', @LockTimeout=0;"

        def wait_signal(name):
            return f"""
DECLARE @deadline_{name} DATETIME2=DATEADD(SECOND,20,SYSUTCDATETIME());
WHILE APPLOCK_TEST('public',N'{name}','Exclusive','Session')=1
BEGIN IF SYSUTCDATETIME()>@deadline_{name} THROW 52000,'rendezvous timeout',1; WAITFOR DELAY '00:00:00.050'; END;"""

        # Existing catalog values only (hit path, no catalog range locks): isolates the root-lock deadlock.
        def writer(first, second, mine, other, first_ver, second_ver, tag, value_a, value_b):
            return f"""
SET NOCOUNT ON; SET LOCK_TIMEOUT 8000;
DECLARE @err INT=0;
BEGIN TRY
    BEGIN TRAN; EXEC data.audit_unit_begin;
    EXEC contacts.email_update @contact_public_key='{first}',@modified_by='{ACTOR}',@expected_entity_version={first_ver},@ordinal=1,@email_address=N'{value_a}';
    {signal(mine)}
    {wait_signal(other)}
    EXEC contacts.email_update @contact_public_key='{second}',@modified_by='{ACTOR}',@expected_entity_version={second_ver},@ordinal=1,@email_address=N'{value_b}';
    COMMIT;
END TRY BEGIN CATCH
    SET @err=ERROR_NUMBER(); IF XACT_STATE()<>0 ROLLBACK;
END CATCH;
PRINT 'PROBE E writer {tag} finished with error ' + CONVERT(VARCHAR(10),@err) + ' (0=committed, 1205=deadlock victim, 1222=lock timeout, 51204/51206=ordering/stale)';
"""
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, writer(root2, root3, 'dl_w1', 'dl_w2', v2, v3, 'w1',
                                            'initial@example.test', 'intermediate@example.test'), main_db),
                    pool.submit(sql, writer(root3, root2, 'dl_w2', 'dl_w1', v3, v2, 'w2',
                                            'restored@example.test', 'transient@example.test'), main_db)]
            for job in jobs:
                print(job.result(timeout=60).strip(), flush=True)
        print(sql(f"""
SET NOCOUNT ON;
DECLARE @a INT=(SELECT COUNT(*) FROM entities.entity_version_history h JOIN entities.entity e ON e.entity_id=h.entity_id WHERE e.public_key='{root2}');
DECLARE @b INT=(SELECT COUNT(*) FROM entities.entity_version_history h JOIN entities.entity e ON e.entity_id=h.entity_id WHERE e.public_key='{root3}');
PRINT 'PROBE E spine rows after deadlock resolution: root2=' + CONVERT(VARCHAR(5),@a) + ' root3=' + CONVERT(VARCHAR(5),@b) + ' (exactly one writer should have advanced both by one, or none if both aborted)';
""", main_db), flush=True)

        # ---------------------------------------------------------------- F. catalog miss-path range locks
        # Distinct NEW values that sort into the same unique-index gap block each other until the holder
        # commits; a new value in a different gap does not. (ADR 0005 mentions the caveat; this measures it.)
        root4 = "E0000000-0000-0000-0000-000000000004"
        v4 = re.search(r"V4=(\d+)", sql(f"""
SET NOCOUNT ON; DECLARE @v4 INT=(SELECT entity_version FROM entities.entity WHERE public_key='{root4}');
PRINT 'V4=' + CONVERT(VARCHAR(10),@v4);""", main_db)).group(1)
        sql(f"""EXEC contacts.contact_email_insert @contact_public_key='{root4}',@created_by='{ACTOR}',@expected_entity_version={v4},@email_address=N'gap-m@example.test';""", main_db)
        v2 = re.search(r"V2=(\d+)", sql(f"""
SET NOCOUNT ON; DECLARE @v2 INT=(SELECT entity_version FROM entities.entity WHERE public_key='{root2}');
PRINT 'V2=' + CONVERT(VARCHAR(10),@v2);""", main_db)).group(1)
        v3 = re.search(r"V3=(\d+)", sql(f"""
SET NOCOUNT ON; DECLARE @v3 INT=(SELECT entity_version FROM entities.entity WHERE public_key='{root3}');
PRINT 'V3=' + CONVERT(VARCHAR(10),@v3);""", main_db)).group(1)
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.contact_email_insert @contact_public_key='{root2}',@created_by='{ACTOR}',@expected_entity_version={v2},@email_address=N'gap-a@example.test';
{signal('gap_holder_ready')}
{wait_signal('gap_probe_done')}
COMMIT;
PRINT 'PROBE F holder committed gap-a';""", main_db), pool.submit(sql, f"""
SET NOCOUNT ON; SET LOCK_TIMEOUT 2000;
{wait_signal('gap_holder_ready')}
DECLARE @same_gap INT=0, @other_gap INT=0;
BEGIN TRY EXEC contacts.contact_email_insert @contact_public_key='{root3}',@created_by='{ACTOR}',@expected_entity_version={v3},@email_address=N'gap-b@example.test'; END TRY
BEGIN CATCH SET @same_gap=ERROR_NUMBER(); IF XACT_STATE()<>0 ROLLBACK; END CATCH;
BEGIN TRY EXEC contacts.contact_email_insert @contact_public_key='{root3}',@created_by='{ACTOR}',@expected_entity_version={v3},@email_address=N'gap-z@example.test'; END TRY
BEGIN CATCH SET @other_gap=ERROR_NUMBER(); IF XACT_STATE()<>0 ROLLBACK; END CATCH;
{signal('gap_probe_done')}
PRINT 'PROBE F unrelated root inserting a NEW value in the SAME index gap as the open unit: error ' + CONVERT(VARCHAR(10),@same_gap)
    + ' (1222 = blocked until holder commits); NEW value in a DIFFERENT gap: error ' + CONVERT(VARCHAR(10),@other_gap) + ' (0 = committed while holder still open)';
WAITFOR DELAY '00:00:01';  -- keep the session-scoped signal visible until the holder polls it""", main_db)]
            for job in jobs:
                print(job.result(timeout=90).strip(), flush=True)

        # ---------------------------------------------------------------- G. exact-value applock alternative (probe only)
        # Does a plain READ COMMITTED seek for a different, absent value block on the neighbouring uncommitted key?
        # Does an exact-value transaction applock serialize only identical values? Probe objects live only in this DB.
        sql("""
CREATE OR ALTER PROCEDURE contacts.review_email_intern_applock @email_address NVARCHAR(MAX), @email_id INT OUTPUT AS
BEGIN
    SET NOCOUNT ON; SET @email_id=NULL;
    DECLARE @key VARBINARY(512)=CONVERT(VARBINARY(512),@email_address), @len INT=DATALENGTH(@email_address);
    SELECT @email_id=email_id FROM contacts.email WHERE value_key=@key AND value_length=@len;
    IF @email_id IS NOT NULL RETURN;
    DECLARE @res NVARCHAR(255)=N'overmind:email:'+CONVERT(NVARCHAR(64),HASHBYTES('SHA2_256',@key),2), @r INT;
    EXEC @r=sys.sp_getapplock @Resource=@res,@LockMode='Exclusive',@LockOwner='Transaction',@DbPrincipal='dbo',@LockTimeout=-1;
    IF @r<0 THROW 52001,'applock failed',1;
    SELECT @email_id=email_id FROM contacts.email WHERE value_key=@key AND value_length=@len;   -- plain recheck, no range lock
    IF @email_id IS NULL BEGIN INSERT contacts.email (email_address) VALUES (@email_address); SET @email_id=SCOPE_IDENTITY(); END;
END;
""", main_db)
        sql("INSERT contacts.email (email_address) VALUES (N'gapx-m@example.test');", main_db)
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, """
SET NOCOUNT ON; BEGIN TRAN; DECLARE @id INT;
EXEC contacts.review_email_intern_applock N'gapx-a@example.test', @id OUTPUT;
""" + signal('applock_holder_ready') + wait_signal('applock_probe_done') + """
COMMIT; PRINT 'PROBE G holder committed gapx-a';""", main_db), pool.submit(sql, """
SET NOCOUNT ON; SET LOCK_TIMEOUT 2000;
""" + wait_signal('applock_holder_ready') + """
DECLARE @plain INT=0, @same_gap INT=0, @same_value INT=0, @id INT;
BEGIN TRY SELECT @id=email_id FROM contacts.email WHERE value_key=CONVERT(VARBINARY(512),N'gapx-b@example.test') AND value_length=DATALENGTH(N'gapx-b@example.test'); END TRY
BEGIN CATCH SET @plain=ERROR_NUMBER(); END CATCH;
BEGIN TRY BEGIN TRAN; EXEC contacts.review_email_intern_applock N'gapx-b@example.test', @id OUTPUT; COMMIT; END TRY
BEGIN CATCH SET @same_gap=ERROR_NUMBER(); IF XACT_STATE()<>0 ROLLBACK; END CATCH;
BEGIN TRY BEGIN TRAN; EXEC contacts.review_email_intern_applock N'gapx-a@example.test', @id OUTPUT; COMMIT; END TRY
BEGIN CATCH SET @same_value=ERROR_NUMBER(); IF XACT_STATE()<>0 ROLLBACK; END CATCH;
""" + signal('applock_probe_done') + """
PRINT 'PROBE G plain RC seek for a different absent value next to the uncommitted key: error ' + CONVERT(VARCHAR(10),@plain)
    + '; applock intern of a different NEW value in the same gap: error ' + CONVERT(VARCHAR(10),@same_gap)
    + ' (0 = no gap contention); applock intern of the SAME value: error ' + CONVERT(VARCHAR(10),@same_value) + ' (1222 = correctly serialized)';
WAITFOR DELAY '00:00:01';""", main_db)]
            for job in jobs:
                print(job.result(timeout=90).strip(), flush=True)

        # ---------------------------------------------------------------- D. RCSI variant
        rcsi_db = new_db_name()
        sql(f"CREATE DATABASE [{rcsi_db}]; ALTER DATABASE [{rcsi_db}] SET READ_COMMITTED_SNAPSHOT ON;", "master")
        created.append(rcsi_db)
        print(f"PROBE D: running SQL fixtures under READ_COMMITTED_SNAPSHOT ON in {rcsi_db}", flush=True)
        sql(setup_script(), rcsi_db)
        out = sql((TESTS / "dbrow_version_tests.sql").read_text(), rcsi_db)
        out += sql((TESTS / "email_family_tests.sql").read_text(encoding="utf-8"), rcsi_db)
        passes = [line for line in out.splitlines() if line.startswith("PASS")]
        print(f"PROBE D: {len(passes)} PASS lines under RCSI (reference SQL fixtures). Concurrency/C# parts not repeated here.", flush=True)
        # Two-connection catalog-miss and same-root schedules under RCSI, borrowed from the reference runner.
        actor = ACTOR
        r2, r3 = root2, root3
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC contacts.email_update @contact_public_key='{r2}',@modified_by='{actor}',@expected_entity_version=1,@ordinal=1,@email_address=N'rcsi-winner@example.test';
{signal('rcsi_writer_ready')}
{wait_signal('rcsi_contender_ready')}
COMMIT;""", rcsi_db), pool.submit(sql, f"""
SET NOCOUNT ON;
{wait_signal('rcsi_writer_ready')}
{signal('rcsi_contender_ready')}
EXEC dbo.expect_email_error N'EXEC contacts.email_update @contact_public_key=''{r2}'',@modified_by=''{actor}'',@expected_entity_version=1,@ordinal=1,@email_address=N''rcsi-loser@example.test'';',51206;""", rcsi_db)]
            for job in jobs:
                job.result(timeout=60)
        with ThreadPoolExecutor(max_workers=2) as pool:
            jobs = [pool.submit(sql, f"""
EXEC contacts.contact_email_insert @contact_public_key='{root}',@created_by='{actor}',@expected_entity_version={ver},
    @email_address=N'rcsi-shared-miss@example.test',@location_name=N'RCSI location';""", rcsi_db) for root, ver in ((r2, 2), (r3, 1))]
            for job in jobs:
                job.result(timeout=60)
        print(sql("""
SET NOCOUNT ON;
DECLARE @n INT=(SELECT COUNT(*) FROM contacts.email WHERE email_address=N'rcsi-shared-miss@example.test');
PRINT 'PROBE D RCSI: same-root stale writer rejected (51206) and concurrent catalog miss produced ' + CONVERT(VARCHAR(5),@n) + ' row(s)';
""", rcsi_db), flush=True)
    finally:
        for db in reversed(created):
            sql(f"ALTER DATABASE [{db}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{db}];", "master")
            print(f"Removed {db}", flush=True)


if __name__ == "__main__":
    main()
