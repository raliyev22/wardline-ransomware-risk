from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch


class IsolatedRunHistory:
    def setUp(self):
        super().setUp()
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        database = patch.dict("os.environ", {"WARDLINE_RUN_DATABASE": str(Path(directory.name) / "runs.sqlite3")})
        database.start()
        self.addCleanup(database.stop)
