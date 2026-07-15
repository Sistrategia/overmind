/*************************************************************************************************************
* Group.cs is part of the Sistrategia Core Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

namespace Sistrategia.Contacts;

public class Group : Contact //, IGroup
{
    public Group()
        : base(PartyType.Group) { }

    public override string? ContactListInfoCard1 => String.Empty;
    public override string? ContactListInfoCard2 => String.Empty;
}
