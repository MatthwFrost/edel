/**
 * NOT IN USE
**/

export async function getUser(){
  return new Promise((resolve, reject) => {
  chrome.identity.getAuthToken({ interactive: true }, async function(token) {
      if (chrome.runtime.lastError) {
        console.error("Error obtaining token:", JSON.stringify(chrome.runtime.lastError, null, 2));
        return;
      }
      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error fetching user info: ${response.status}`);
        }

        let userInfo = await response.json();
        resolve({userInfo});
      } catch (error) {
        console.error("Error in extension setup:", error.message);
        reject(error)
      }
    });
  })
}
