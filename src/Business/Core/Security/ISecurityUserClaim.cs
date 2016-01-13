/**************************************************************************
 * Copyright 2015 (c) JEOCSI SA DE CV (Sistrategia) All rights reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ************************************************************************/

using System;

namespace Sistrategia.Overmind.Security
{
    public interface ISecurityUserClaim
    {
        int Id { get; set; }
        int UserId { get; set; }
        string ClaimType { get; set; }
        string ClaimValue { get; set; }
    }
}
