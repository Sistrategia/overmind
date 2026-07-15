/*************************************************************************************************************
* TransactionDAC.cs is part of the Sistrategia.Data Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

using System;
using System.Data;
using System.Data.Common;
// using Microsoft.Extensions.Logging;

namespace Sistrategia.Data;

public abstract class TransactionDAC
{
    protected readonly DbConnection DbConnection;
    protected readonly DbTransaction? DbTransaction;

    public TransactionDAC(DbConnection connection, DbTransaction? transaction = null) {
        if (connection is null)
            throw new ArgumentNullException(nameof(connection));
        // if (connection.State != System.Data.ConnectionState.Open)
        //     throw new ArgumentException("Connection must be open.", nameof(connection));
        if (transaction is not null && transaction.Connection != connection)
            throw new ArgumentException("Transaction must be associated with the connection.", nameof(transaction));

        DbConnection = connection;
        DbTransaction = transaction;
    }

    public TransactionDAC(DbTransaction transaction) {
        if (transaction is null)
            throw new ArgumentNullException(nameof(transaction));
        if (transaction.Connection is null)
            throw new ArgumentException("Transaction must be associated with a connection.", nameof(transaction));
        // if (transaction.Connection.State != System.Data.ConnectionState.Open)
        //     throw new ArgumentException("Connection must be open.", nameof(transaction));

        DbConnection = transaction.Connection;
        DbTransaction = transaction;
    }

    protected abstract DbCommand CreateCommand(string commandString);
}