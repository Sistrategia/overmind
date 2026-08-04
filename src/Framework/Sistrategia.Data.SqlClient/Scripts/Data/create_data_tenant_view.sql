CREATE VIEW [data].[tenant_view] AS
SELECT t.[tenant_id]
     , t.[public_key]
     , t.[name]
     , v.[dbrow_version]
     , v.[modified]
     , v.[modified_by]
FROM [data].[tenant] AS t
LEFT JOIN [data].[dbrow_version] AS v 
    ON (v.[tenant_id] = t.[tenant_id])
WHERE (v.[dbrow_version] = (
        SELECT MAX([dbrow_version]) 
        FROM [data].[dbrow_version] 
        WHERE [tenant_id] = t.[tenant_id]
    )
)