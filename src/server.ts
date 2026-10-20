import "dotenv/config"
import app from "./app"
import { failOrphanedScans } from "./services/scan.service"

const PORT = process.env.PORT || 4000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)

  failOrphanedScans()
    .then((count) => {
      if (count > 0) {
        console.log(`Marked ${count} orphaned scan(s) as FAILED`)
      }
    })
    .catch((err) => {
      console.error("Failed to clean up orphaned scans:", err)
    })
})
