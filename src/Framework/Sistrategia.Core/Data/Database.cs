// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using System.Data;
using System.Data.Common;
using Microsoft.Extensions.Logging;

namespace Sistrategia.Data;

/// <summary>
/// Represents an abstract database that provides database access methods
/// and a set of high level services for schema deployment and versioning.
/// </summary>
/// <remarks>
/// The <see cref="Database"/> class leverages the provider factory model from ADO.NET. 
/// A database instance holds a reference to a concrete <see cref="DbProviderFactory"/> object 
/// to which it forwards the creation of ADO.NET objects.
/// </remarks>
public abstract partial class Database
{
    protected readonly string ConnectionString;
    protected readonly DbProviderFactory DbProviderFactory;
    private readonly ILogger<Database> Logger;

    public Database(string connectionString, DbProviderFactory dbProviderFactory, ILogger<Database> logger) {
        ConnectionString = connectionString;
        DbProviderFactory = dbProviderFactory;
        Logger = logger;
    }

    #region Connections and Transactions

    /// <summary>
    /// Creates a connection for this database.
    /// </summary>
    /// <returns>
    /// The <see cref="DbConnection"/> for this database.
    /// </returns>
    /// <seealso cref="DbConnection"/>
    public virtual DbConnection CreateConnection() {
        DbConnection? newConnection = DbProviderFactory.CreateConnection();
        if (newConnection != null) {
            newConnection.ConnectionString = ConnectionString;
        } else {
            throw new NullReferenceException("DbProviderFactory cannot create a new connection.");
        }
        return newConnection;
    }

    /// <summary>
    /// Creates and opens a connection.
    /// </summary>                
    /// <returns>The opened connection.</returns>
    public DbConnection OpenConnection() {
        DbConnection? connection = null;
        try {
            try {
                connection = CreateConnection();
                connection.Open();
            } catch (Exception e) {
                WriteToLog(e.Message, e); // ConnectionStringNoCredentials
                throw;
            }
            WriteToLog("Connection opened");
        } catch {
            if (connection != null)
                connection.Close();
            throw;
        }
        return connection;
    }

    /// <summary>
    /// Creates a transaction for this database.
    /// </summary>
    /// <returns>
    /// The <see cref="DbTransaction"/> for this database.
    /// </returns>
    /// <seealso cref="DbTransaction"/>
    public virtual DbTransaction CreateTransaction() {
        var connection = OpenConnection();
        return connection.BeginTransaction();
    }

    #endregion

    #region Commands

    /// <summary>
    /// Returns a new instance of the provider's class that implements the 
    /// System.Data.DbCommand class.
    /// </summary>
    /// <returns>A new instance of System.Data.DbCommand.</returns>
    public virtual DbCommand? CreateCommand() => DbProviderFactory.CreateCommand();

    /// <summary>
    /// Returns a new instance of the provider's class that implements the 
    /// System.Data.DbCommand class.
    /// </summary>
    /// <param name="transaction">
    /// <para>The <see cref="IDbTransaction"/> to execute the command within.</para>
    /// </param>
    /// <returns></returns>
    public virtual DbCommand? CreateCommand(DbTransaction? transaction) {
        if (transaction == null) throw new ArgumentNullException(nameof(transaction));
        var command = CreateCommand();
        InitializeCommand(command, transaction);
        return command;
    }

    /// <summary>
    /// Returns a new instance of the provider's class that implements the 
    /// System.Data.IDbCommand class.
    /// </summary>
    /// <param name="commandType"></param>
    /// <param name="commandText"></param>
    /// <returns>A new instance of System.Data.IDbCommand.</returns>        
    public virtual DbCommand? CreateCommand(CommandType commandType, string? commandText) {
        if (string.IsNullOrEmpty(commandText))
            throw new ArgumentException("The value can not be null or an empty string.", nameof(commandText));
        var command = CreateCommand();
        if (command != null) {
            command.CommandType = commandType;
            command.CommandText = commandText;
        }
        return command;
    }

    /// <summary>
    /// Returns a new instance of the provider's class that implements the 
    /// System.Data.IDbCommand class.
    /// </summary>
    /// <param name="commandType"></param>
    /// <param name="commandText"></param>
    /// <returns>A new instance of System.Data.IDbCommand.</returns>        
    public virtual DbCommand? CreateCommandString(string? commandText) =>
        CreateCommand(CommandType.Text, commandText);

    #region Command Initialization

    /// <summary>
    /// <para>Assigns a <paramref name="transaction"/> to the <paramref name="command"/>.</para>
    /// </summary>
    /// <param name="command"><para>The command that contains the query to prepare.</para></param>
    /// <param name="transaction">The transaction to assign to the command.</param>
    protected static void InitializeCommand(DbCommand? command, DbTransaction? transaction) {
        if (command == null) throw new ArgumentNullException(nameof(command));
        if (transaction == null) throw new ArgumentNullException(nameof(transaction));

        InitializeCommand(command, transaction.Connection);
        command.Transaction = transaction;
    }

    /// <summary>
    /// <para>Assigns a <paramref name="connection"/> to the <paramref name="command"/>.</para>
    /// </summary>
    /// <param name="command"><para>The command that contains the query to prepare.</para></param>
    /// <param name="connection">The connection to assign to the command.</param>
    protected static void InitializeCommand(DbCommand? command, DbConnection? connection) {
        if (command == null) throw new ArgumentNullException(nameof(command));
        command.Connection = connection ?? throw new ArgumentNullException(nameof(connection));
    }

    #endregion

    #endregion

    #region ExecuteNonQuery

    /// <summary>
    /// Executes the <paramref name="command"/> and returns the number of rows affected.
    /// </summary>
    /// <param name="command">
    /// The command that contains the query to execute.
    /// </param>       
    /// <returns>The quantity of rows affected.</returns>
    public virtual int ExecuteNonQuery(DbCommand? command) {
        using (DbConnection connection = OpenConnection()) {
            InitializeCommand(command, connection);
            return DoExecuteNonQuery(command);
        }
    }

    public int ExecuteNonQuery(CommandType commandType, string? commandText) {
        using var command = CreateCommand(commandType, commandText);
        return ExecuteNonQuery(command);
    }

    public int ExecuteNonQuery(string? commandText) {
        using var command = CreateCommandString(commandText);
        //Logger.LogTrace(commandText);
        return ExecuteNonQuery(command);
    }

    private int DoExecuteNonQuery(DbCommand? command) {
        if (command == null) throw new ArgumentNullException(nameof(command));
        try {
            // DateTime startTime = DateTime.Now;
            WriteToLog(command.CommandText);
            int rowsAffected = command.ExecuteNonQuery();
            // Write(startTime);
            return rowsAffected;
        } catch (Exception e) {
            WriteToLog(command.CommandText, e);
            throw;
        }
    }

    #endregion

    public virtual void RunLocalStoredCommands(System.Reflection.Assembly assembly, string resourceName) {
        if (resourceName == null)
            throw new ArgumentNullException(nameof(resourceName));
        var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream == null)
            throw new ArgumentNullException(nameof(resourceName));
        TextReader textReader = new StreamReader(stream);
        RunLocalStoredCommands(textReader);
    }

    public abstract void RunLocalStoredCommands(TextReader textReader);

    #region Supporting Methods

    protected void WriteToLog(string? message) {
        if (Logger.IsEnabled(LogLevel.Trace)) {
            Logger.LogTrace(message);
        }
    }

    protected void WriteToLog(Exception exception) {
        if (Logger.IsEnabled(LogLevel.Trace)) {
            Logger.LogTrace(exception, null);
        }
    }

    protected void WriteToLog(string? message, Exception? exception) {
        if (Logger.IsEnabled(LogLevel.Trace)) {
            Logger.LogTrace(exception, message);
        }
    }

    #endregion
}
