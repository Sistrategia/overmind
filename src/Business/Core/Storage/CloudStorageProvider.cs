using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Sistrategia.Overmind.Storage
{
    public class CloudStorageProvider
    {
        public string CloudStorageProviderId { get; set; }

        [MaxLength(512)]
        public string Name { get; set; }

        public string Description { get; set; }
    }
}
