"""Run against an isolated disposable database, never an application database.

Requires Python 3, sqlcmd, and integrated-auth CREATE DATABASE permission.
Usage: python tests/sql/run_dbrow_version_tests.py --server localhost
Actual repository DDL/procedures are loaded; optional address/phone/role workflows
are outside these focused allocation tests. No mocks replace the tested procedures.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import re
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "src/Framework/Sistrategia.Data.SqlClient/Scripts"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--server", default="localhost")
    args = parser.parse_args()
    database = "OvermindAuditTest_" + uuid.uuid4().hex
    assert re.fullmatch(r"OvermindAuditTest_[0-9a-f]{32}", database)

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

    created = False
    try:
        sql(f"CREATE DATABASE [{database}];", "master")
        created = True
        print(f"Testing in {database}", flush=True)
        files = [
            "Data/create_data_schema.sql",
            "Entities/create_entities_schema.sql",
            "Contacts/create_contact_schema.sql",
            "Contacts/Phones/create_phone_schema.sql",
            "Contacts/Emails/create_email_schema.sql",
            "Contacts/Addresses/create_address_schema.sql",
            "Security/User/create_security_user_schema.sql",
            "Entities/Events/create_events_schema.sql",
            "Data/create_dbrow_version_ensure.sql",
            "Entities/create_entity_insert.sql",
            "Contacts/create_contact_insert.sql",
            "Security/User/create_security_user_insert.sql",
            "Entities/Events/create_event_create.sql",
        ]
        setup = "\nGO\n".join(f"CREATE SCHEMA [{s}];" for s in ["data", "entities", "contacts", "security"])
        setup += "\nGO\n" + "\nGO\n".join((SCRIPTS / f).read_text(encoding="utf-8-sig") for f in files)
        sql(setup)
        print(sql((Path(__file__).with_name("dbrow_version_tests.sql")).read_text()), flush=True)

        # Separate connections allocate simultaneously; sequence gaps are deliberately permitted.
        worker = """
SET NOCOUNT ON;
DECLARE @i INT = 0, @v BIGINT;
WHILE @i < 20
BEGIN
    BEGIN TRANSACTION;
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
    finally:
        if created:
            # Only the generated, validated test name is ever dropped.
            sql(f"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}];", "master")
            print(f"Removed {database}", flush=True)


if __name__ == "__main__":
    main()
