/*************************************************************************************************************
* SqlBaseDAC.cs is part of the Sistrategia.Data.SqlClient Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Sistrategia.Data.SqlClient;

public abstract class SqlBaseDACMapper<T>
{
    public static async Task<string> GetStringAsync(SqlDataReader reader, string columnName) {
        return await reader.GetFieldValueAsync<string>(reader.GetOrdinal(columnName));
    }

    public static async Task<string?> GetStringOrNullAsync(SqlDataReader reader, string columnName) {
        return await reader.IsDBNullAsync(reader.GetOrdinal(columnName)) ? null : await reader.GetFieldValueAsync<string>(reader.GetOrdinal(columnName));
    }

    public static async Task<Guid> GetGuidAsync(SqlDataReader reader, string columnName) {
        return await reader.GetFieldValueAsync<Guid>(reader.GetOrdinal(columnName));
    }

    public static async Task<Guid?> GetGuidOrNullAsync(SqlDataReader reader, string columnName) {
        return await reader.IsDBNullAsync(reader.GetOrdinal(columnName)) ? null : await reader.GetFieldValueAsync<Guid>(reader.GetOrdinal(columnName));
    }

    public static async Task<string> GetGuidAsStringAsync(SqlDataReader reader, string columnName) {
        return (await reader.GetFieldValueAsync<Guid>(reader.GetOrdinal(columnName))).ToString("N");
    }

    public static async Task<string?> GetGuidAsStringOrNullAsync(SqlDataReader reader, string columnName) {
        return await reader.IsDBNullAsync(reader.GetOrdinal(columnName)) ? null : reader.GetGuid(reader.GetOrdinal(columnName)).ToString();
    }

    public static async Task<long> GetLongAsync(SqlDataReader reader, string columnName) {
        return await reader.GetFieldValueAsync<long>(reader.GetOrdinal(columnName));
    }

    public static async Task<DateTime> GetDateTimeAsync(SqlDataReader reader, string columnName) {
        return await reader.GetFieldValueAsync<DateTime>(reader.GetOrdinal(columnName));
    }

    public static async Task<DateTime?> GetDateTimeOrNullAsync(SqlDataReader reader, string columnName) {
        return await reader.IsDBNullAsync(reader.GetOrdinal(columnName)) ? null : await reader.GetFieldValueAsync<DateTime>(reader.GetOrdinal(columnName));
    }

    /// <summary>
    /// Reads a SQL DATE column as DateOnly (non-nullable).
    /// </summary>
    public static async Task<DateOnly> GetDateOnlyAsync(SqlDataReader reader, string columnName) {
        return await reader.GetFieldValueAsync<DateOnly>(reader.GetOrdinal(columnName));
    }

    /// <summary>
    /// Reads a SQL DATE column as DateOnly? (nullable).
    /// </summary>
    public static async Task<DateOnly?> GetDateOnlyOrNullAsync(SqlDataReader reader, string columnName) {
        return await reader.IsDBNullAsync(reader.GetOrdinal(columnName)) ? null : await reader.GetFieldValueAsync<DateOnly>(reader.GetOrdinal(columnName));
    }

    public abstract Task FillAsync(T entity, SqlDataReader reader);
}