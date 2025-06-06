import { fetchGoogleDriveFiles } from '@lib/googleDrive';

async function test() {
  const files = await fetchGoogleDriveFiles();
  console.log(
    '📄 Google Drive Files:',
    files.map((f) => f.name)
  );
}

test();
