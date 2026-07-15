// Copyright (c) Jose Ernesto Ocampo Cicero / JEOCSI SA DE CV (Sistrategia). All rights reserved.
// Licensed under the Apache License, Version 2.0. See LICENSE in the project root for license information.

namespace Sistrategia.Data;

public interface IDatabaseSchemaBuilder
{
    string SchemaName { get; }
    string SchemaDescription { get; }
    string Version { get; }

    void CreateSchemaObjects();
    void DropSchemaObjects();
    void CreateSchemaTables();
    void DropSchemaTables();
    void CreateSchemaViews();
    void DropSchemaViews();
    void CreateSchemaFunctions();
    void DropSchemaFunctions();
    void DropSchemaTypes();
    void InsertMinimalData();
}
