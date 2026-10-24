-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "city" TEXT,
ADD COLUMN     "competitors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "knownFor" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "mapsUrl" TEXT,
ADD COLUMN     "nameVariants" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "website" TEXT;

