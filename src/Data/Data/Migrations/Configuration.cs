namespace Sistrategia.Overmind.Data.Migrations
{
    using Sistrategia.Overmind.Security;
    using Sistrategia.Overmind.Storage;
    using System;
    using System.Data.Entity;
    using System.Data.Entity.Migrations;
    using System.Linq;

    internal sealed class Configuration : DbMigrationsConfiguration<Sistrategia.Overmind.Data.ApplicationDbContext>
    {
        public Configuration()
        {
            AutomaticMigrationsEnabled = false;
            ContextKey = "Sistrategia.Overmind.Data.ApplicationDbContext";
        }

        protected override void Seed(Sistrategia.Overmind.Data.ApplicationDbContext context)
        {
            //  This method will be called after migrating to the latest version.

            //  You can use the DbSet<T>.AddOrUpdate() helper extension method 
            //  to avoid creating duplicate seed data. E.g.
            //
            //    context.People.AddOrUpdate(
            //      p => p.FullName,
            //      new Person { FullName = "Andrew Peters" },
            //      new Person { FullName = "Brice Lambson" },
            //      new Person { FullName = "Rowan Miller" }
            //    );
            //

            context.Roles.AddOrUpdate(
                r => r.Name,
                //new SecurityRole { Id = "c112296f-9ba2-49c7-9852-ac2f5441a774", Name = "Administrator" },
                //new SecurityRole { Id = "373add78-ead8-4358-aeca-4f4c53e80bac", Name = "Developer" },
                //new SecurityRole { Id = "3526c3ca-a3fb-48fe-a3ee-f625816c9080", Name = "User" }

                new SecurityRole { Id = 1, Name = "User" },
                new SecurityRole { Id = 2, Name = "Administrator" },
                new SecurityRole { Id = 3, Name = "Backstage" },
                new SecurityRole { Id = 4, Name = "Developer" }
            );
           //  context.SaveChanges();

            var azure = new CloudStorageProvider { CloudStorageProviderId = "Azure", Name = "Microsoft Azure Storage Provider", Description = "Microsoft Azure Storage Provider." };

            context.CloudStorageProviders.AddOrUpdate(p => p.CloudStorageProviderId,
                azure,
                new CloudStorageProvider { CloudStorageProviderId = "Amazon", Name = "Amazon S3 Provider", Description = "Microsoft Simple Storage Provider." },
                new CloudStorageProvider { CloudStorageProviderId = "Rackspace", Name = "Rackspace CloudFiles Provider", Description = "Rackspace Cloud Files Provider." }
                );



            context.SaveChanges();
        }
    }
}
