/*************************************************************************************************************
* create_data_sequence_next_number.sql is part of the Sistrategia.Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):   J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:      2022-Jan-04
* Created:          2010-Sep-08
* Version:          6.0.6829.0
*************************************************************************************************************/

CREATE PROCEDURE [data].[sequence_next_number] (	
     @sequence_id       AS INT
    ,@sequence_number   AS NVARCHAR(50) OUTPUT
)
AS
BEGIN

    SET NOCOUNT ON;

    DECLARE @TranStarted BIT
    SET @TranStarted = 0

    BEGIN TRY

        IF( @@TRANCOUNT = 0 )
        BEGIN
            SET XACT_ABORT ON;
            BEGIN TRANSACTION SequenceNextNumber
            SET @TranStarted = 1
        END
        ELSE
            SET @TranStarted = 0        

        DECLARE @last_number INT

        UPDATE [data].[sequence] SET 
            @last_number = [last_number] = [last_number] + 1
        FROM [data].[sequence]
        WHERE [sequence_id] = @sequence_id

        SET @sequence_number = (
            SELECT [prefix] + RIGHT(REPLICATE('0', [padding]) + CONVERT(NVARCHAR(20), [last_number]), [padding]) AS [sequence_number]
            FROM [data].[sequence]
            WHERE [sequence_id] = @sequence_id)

        SELECT @sequence_number

        IF( @TranStarted = 1 )
        BEGIN
            SET @TranStarted = 0
            COMMIT TRANSACTION SequenceNextNumber
        END

    END TRY
    BEGIN CATCH

        DECLARE @ErrorNo int,
        @Severity tinyint,
        @State smallint,
        @LineNo int,
        @Message nvarchar(4000);

        SELECT
            @ErrorNo = ERROR_NUMBER(),
            @Severity = ERROR_SEVERITY(),
            @State = ERROR_STATE(),
            @LineNo = ERROR_LINE (),
            @Message = ERROR_MESSAGE();

        -- Rollback any active or uncommittable transactions before
        -- inserting information in the ErrorLog
        IF (@TranStarted = 1 AND @@TRANCOUNT > 0)
        BEGIN
            SET @TranStarted = 0
            ROLLBACK TRANSACTION SequenceNextNumber
        END

        BEGIN
            RAISERROR(@Message, 16, 1 );
        END

    END CATCH;

END