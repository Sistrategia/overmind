"""Competing promotions use the real constructor and root-lock protocol in disposable databases."""


def run(sql, concurrent, signal, wait_signal, actor):
    root = "E0000000-0000-0000-0000-000000000041"
    sql(f"EXEC contacts.contact_insert @public_key='{root}',@created_by='{actor}',@full_name=N'Promotion contention';")
    concurrent(f"""
SET NOCOUNT ON; BEGIN TRAN; EXEC data.audit_unit_begin;
EXEC security.user_insert @public_key='{root}',@created_by='{actor}',@expected_entity_version=1,
    @login_name=N'promotion-winner',@full_name=N'Promotion contention';
{signal('promotion_ready')}
{wait_signal('promotion_contender')}
WAITFOR DELAY '00:00:00.500';
COMMIT;
""", f"""
SET NOCOUNT ON;
{wait_signal('promotion_ready')}
{signal('promotion_contender')}
EXEC dbo.expect_email_error N'EXEC security.user_insert @public_key=''{root}'',@created_by=''{actor}'',@expected_entity_version=1,
    @login_name=N''promotion-loser'',@full_name=N''Promotion contention'';',51206;
""")
    sql(f"""
DECLARE @id INT=(SELECT entity_id FROM entities.entity WHERE public_key='{root}');
IF NOT EXISTS (SELECT 1 FROM entities.entity e JOIN security.[user] u ON u.user_id=e.entity_id
    WHERE e.entity_id=@id AND e.entity_version=2 AND e.entity_type_id=4 AND u.login_name=N'promotion-winner')
    OR (SELECT COUNT(*) FROM security.user_history WHERE user_id=@id)<>1
    OR (SELECT COUNT(*) FROM entities.entity_history WHERE entity_id=@id)<>2
    THROW 52000,'Competing promotions produced duplicate account/type history or lost the winner.',1;
""")
    print("PASS user concurrency: one promotion wins; the stale contender cannot overwrite it or add history", flush=True)
