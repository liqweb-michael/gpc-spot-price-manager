export async function markAsProcessed(uuid: string, options = {}) {
    const url = process.env.ingester_url + '/processed';

    console.info(uuid, 'Marking data as processed in ingester');
    const response = await fetchWithRetry(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uuids: [uuid]
        })
    });
}



export async function fetchWithRetry(url:string, options: any, maxRetries = 3) {
    let retries = 0;
  
    while (retries < maxRetries) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (error) {
        retries++;
        console.error(`Fetch failed (${retries}/${maxRetries}), retrying...`, error);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 seconds before retrying
      }
    }
  
    console.error(`Fetch failed after ${maxRetries} retries.`);
}

export default {};