// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using System.Data;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Sistrategia.Data.SqlClient;

public class SqlDatabase : Database
{
    public SqlDatabase(string connectionString, ILogger<Database> logger)
        : base(connectionString, SqlClientFactory.Instance, logger) { }

    public override void RunLocalStoredCommands(TextReader textReader)
    {
        SqlCommand? command = CreateCommand() as SqlCommand;
        if (command != null)
        {
            command.CommandType = CommandType.Text;
            command.CommandText = textReader.ReadToEnd();

            SqlConnection? connection = CreateConnection() as SqlConnection;
            if (connection != null)
            {
                SqlTransaction? transaction = null;
                try
                {
                    connection.Open();
                    transaction = connection.BeginTransaction();
                    // transaction.IsolationLevel = IsolationLevel.ReadUncommitted;
                    command.Transaction = transaction;
                    command.Connection = connection;
                    command.ExecuteNonQuery();
                    transaction.Commit();
                }
                catch (Exception ex)
                {
                    ex.ToString();
                    if (transaction != null)
                        transaction.Rollback();
                    // throw ex;
                    throw;
                }
                finally
                {
                    // when trasaction is commited (transaction.Commit()) the .Net Framework set the connection property to null
                    // we need to get the connection from the command
                    if (connection != null && connection.State == ConnectionState.Open)
                        command.Connection.Close();
                }
            }
        }
    }
}
