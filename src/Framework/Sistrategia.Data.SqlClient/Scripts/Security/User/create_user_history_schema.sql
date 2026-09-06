-- Non-secret account payload. This pass records construction; later account mutations must
-- adopt the same aggregate/history protocol before claiming complete user-lifecycle coverage.
CREATE TABLE [security].[user_history] (
    [dbrow_version] BIGINT NOT NULL, [tenant_id] INT NOT NULL, [user_id] INT NOT NULL,
    [dboperation_type_id] INT NOT NULL,
    [login_name] NVARCHAR(256) NOT NULL, [email] NVARCHAR(256) NULL, [email_confirmed] BIT NOT NULL,
    [phone_number] NVARCHAR(16) NULL, [phone_number_confirmed] BIT NOT NULL,
    [two_factor_enabled] BIT NOT NULL, [lockout_end] DATETIMEOFFSET NULL, [lockout_enabled] BIT NOT NULL,
    CONSTRAINT [pk_user_history] PRIMARY KEY ([dbrow_version],[user_id]),
    CONSTRAINT [fk_user_history_owner] FOREIGN KEY ([tenant_id],[user_id]) REFERENCES [entities].[entity]([tenant_id],[entity_id]),
    CONSTRAINT [fk_user_history_ledger] FOREIGN KEY ([tenant_id],[dbrow_version]) REFERENCES [data].[dbrow_version]([tenant_id],[dbrow_version]),
    CONSTRAINT [ck_user_history_operation] CHECK ([dboperation_type_id] IN (1,2,3))
);
CREATE INDEX [ix_user_history_root] ON [security].[user_history] ([user_id],[dbrow_version] DESC);
