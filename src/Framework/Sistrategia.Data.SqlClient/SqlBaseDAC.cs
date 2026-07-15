/*************************************************************************************************************
* SqlBaseDAC.cs is part of the Sistrategia.Data.SqlClient Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

using System.Data.Common;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
// using Sistrategia.Collections;
// using Sistrategia.Entities;
// using Sistrategia.Security;
// using SortOrder = Sistrategia.Collections.SortOrder;

namespace Sistrategia.Data.SqlClient;

public class SqlBaseDAC : TransactionDAC
{
    // private readonly ISecurityContext SecurityContext;    
    private readonly ILogger? Logger;

    public SqlBaseDAC(SqlConnection connection, SqlTransaction? transaction = null, ILogger? logger = null)
        : base(connection, transaction) {
        if (connection is null)
            throw new ArgumentNullException(nameof(connection));
        // if (connection.State != System.Data.ConnectionState.Open)
        //     throw new ArgumentException("Connection must be open.", nameof(connection));
        if (transaction is not null && transaction.Connection != connection)
            throw new ArgumentException("Transaction must be associated with the connection.", nameof(transaction));
        Logger = logger;
    }

    public SqlBaseDAC(SqlConnection connection, ILogger? logger = null)
        : base(connection) {
        if (connection is null)
            throw new ArgumentNullException(nameof(connection));
        // if (connection.State != System.Data.ConnectionState.Open)
        //     throw new ArgumentException("Connection must be open.", nameof(connection));        
        Logger = logger;
    }

    public SqlBaseDAC(SqlTransaction transaction, ILogger? logger = null)
        : base(transaction) {
        if (transaction is null)
            throw new ArgumentNullException(nameof(transaction));
        if (transaction.Connection is null)
            throw new ArgumentException("Transaction must be associated with a connection.", nameof(transaction));
        // if (transaction.Connection.State != System.Data.ConnectionState.Open)
        //     throw new ArgumentException("Connection must be open.", nameof(transaction));
        Logger = logger;
    }

    // protected SqlConnection Connection => DbConnection as SqlConnection ?? throw new InvalidOperationException("Connection is not a SqlConnection.");
    // protected SqlTransaction? Transaction => DbTransaction as SqlTransaction;

    protected SqlConnection Connection => (SqlConnection)DbConnection;
    protected SqlTransaction? Transaction => (SqlTransaction?)DbTransaction;

    protected void LogDebug(SqlCommand command) {
        if (Logger is null)
            return;

        Logger.LogDebug(command.CommandText);
        foreach (SqlParameter parameter in command.Parameters) {
            Logger.LogDebug(parameter.ParameterName + " = " + parameter.Value);
        }
    }

    protected void LogDebug(string message) {
        if (Logger is null)
            return;

        Logger.LogDebug(message);
    }

    protected SqlCommand CreateSqlCommand(string commandString) =>
        new(commandString, Connection, Transaction);

    protected override DbCommand CreateCommand(string commandString) =>
        CreateSqlCommand(commandString);
}