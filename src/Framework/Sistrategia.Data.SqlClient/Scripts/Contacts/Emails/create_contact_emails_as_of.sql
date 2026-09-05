-- Internal relational building block. The public reader validates tenant/revision and
-- supplies a consistent transaction. An absent/tombstoned child does not appear.
CREATE OR ALTER FUNCTION [contacts].[contact_emails_as_of] (@contact_id INT, @bound BIGINT)
RETURNS TABLE
AS RETURN (
    SELECT h.[ordinal],h.[email_id],v.[email_address],h.[location_id],l.[location_name],h.[is_public],h.[dbrow_version]
    FROM [contacts].[contact_email_identity] i
    CROSS APPLY (
        SELECT TOP(1) * FROM [contacts].[contact_email_history] h
        WHERE h.[contact_id]=i.[contact_id] AND h.[ordinal]=i.[ordinal] AND h.[dbrow_version]<=@bound
        ORDER BY h.[dbrow_version] DESC
    ) h
    JOIN [contacts].[email] v ON v.[email_id]=h.[email_id]
    LEFT JOIN [contacts].[email_location] l ON l.[location_id]=h.[location_id]
    WHERE i.[contact_id]=@contact_id AND i.[created_version]<=@bound AND h.[dboperation_type_id]<>3
);
