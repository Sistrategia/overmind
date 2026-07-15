// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

using System.Text;
using Microsoft.Data.SqlClient;

namespace Sistrategia.Data.SqlClient;

internal static class SqlDatabaseCreator
{
    public static void CreateDatabase(string connectionString) {
        var connStringBuilder = new SqlConnectionStringBuilder(connectionString);
        string? dataFileName = null;
        string? logFileName = null;
        var attachDBFile = connStringBuilder.AttachDBFilename;
        if (string.IsNullOrEmpty(attachDBFile)) {
            dataFileName = null;
            logFileName = null;
        } else {
            if (string.IsNullOrEmpty(attachDBFile)
                || !attachDBFile.StartsWith("|datadirectory|", StringComparison.OrdinalIgnoreCase))
                dataFileName = attachDBFile;
            else {
                var rootFolderObject = AppDomain.CurrentDomain.GetData("DataDirectory");
                var rootFolderPath = rootFolderObject as string;
                if (rootFolderPath == String.Empty)
                    rootFolderPath = AppDomain.CurrentDomain.BaseDirectory;
                dataFileName = attachDBFile["|datadirectory|".Length..];
                if (dataFileName.StartsWith(@"\", StringComparison.Ordinal))
                    dataFileName = dataFileName[1..];
                if (!string.IsNullOrEmpty(rootFolderPath)) {
                    var fixedRoot = rootFolderPath.EndsWith(@"\", StringComparison.Ordinal)
                            ? rootFolderPath
                            : rootFolderPath + @"\";
                    dataFileName = fixedRoot + dataFileName;
                } else {
                    dataFileName = @"\" + dataFileName;
                }
                var directory = new System.IO.FileInfo(dataFileName).Directory;
                if (directory != null) {
                    logFileName = System.IO.Path.Combine(directory.FullName,
                        String.Concat(System.IO.Path.GetFileNameWithoutExtension(dataFileName), "_log.ldf"));
                }
            }
        }

        var databaseName = connStringBuilder.InitialCatalog;
        // https://msdn.microsoft.com/en-us/library/ms176061.aspx
        StringBuilder sb = new StringBuilder();
        sb.Append("CREATE DATABASE ");
        sb.Append("[");
        sb.Append(databaseName);
        sb.Append("]");
        if (!string.IsNullOrEmpty(dataFileName) && !string.IsNullOrEmpty(logFileName)) {
            sb.Append(" ON PRIMARY ");
            sb.Append("(name=");
            sb.Append("N'" + System.IO.Path.GetFileName(dataFileName).Replace("'", "''") + "'");
            sb.Append(", filename=");
            sb.Append("N'" + dataFileName.Replace("'", "''") + "'");
            sb.Append(")");
            sb.Append(" LOG ON ");
            sb.Append("(name=");
            sb.Append("N'" + System.IO.Path.GetFileName(logFileName).Replace("'", "''") + "'");
            sb.Append(", filename=");
            sb.Append("N'" + logFileName.Replace("'", "''") + "'");
            sb.Append(")");
            var directory = new System.IO.FileInfo(dataFileName).Directory;
            if (directory != null && !System.IO.Directory.Exists(directory.FullName))
                System.IO.Directory.CreateDirectory(directory.FullName);
            // sb.Append(" COLLATE SQL_Latin1_General_CP1_CI_AI ");
        }
        var createCommand = sb.ToString();
        var connStringBuilder2 = new SqlConnectionStringBuilder(connectionString) {
            InitialCatalog = "master",
            AttachDBFilename = string.Empty
        };
        using (var masterConn = new SqlConnection(connStringBuilder2.ConnectionString)) {
            var command = new SqlCommand(createCommand, masterConn);
            masterConn.Open();
            command.ExecuteNonQuery();
        }
    }
}
