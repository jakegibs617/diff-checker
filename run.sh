#!/bin/bash
ENV1="url.com/jsonapi/..."
ENV2="url.com/jsonapi/..."

# Curl create article on env1 and get the nid
RESPONSE=$(curl --location `$ENV1` \
--header 'Content-Type: application/vnd.api+json' \
--header 'Authorization: Basic ABC123TBDINPUTME=' \
--data '{
    "data": {
        "type": "...",
        "attributes": {
            "title": "title Lorem ipsum dolor sit amet, consectetur adipiscing elit",
            "moderation_state": "published",
            "body": {
                "value": "\n<p>body value Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>"
            },
        }
    }
}')

# Curl create article on qa and get the nid
RESPONSE2=$(curl --location `$ENV2` \
--header 'Content-Type: application/vnd.api+json' \
--header 'Authorization: Basic ABC123TBDINPUTME=' \
--data '{
    "data": {
        "type": "...",
        "attributes": {
            "title": "title Lorem ipsum dolor sit amet, consectetur adipiscing elit",
            "moderation_state": "published",
            "body": {
                "value": "\n<p>body value Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>"
            },
        }
    }
}')

# After the first curl command to create article on dev
DEV_NID=$(echo $RESPONSE | jq -r '.data.attributes.drupal_internal__nid')

# After the second curl command to create article on qa
QA_NID=$(echo $RESPONSE2 | jq -r '.data.attributes.drupal_internal__nid')

# Debug check, print NIDs in terminal
echo "Dev NID: $DEV_NID"
echo "QA NID: $QA_NID"

# Define the endpoints
drupal_9_solr_endpoint="example.com/solr/my_collection/select?q=its_nid:$DEV_NID"
drupal_10_solr_endpoint="example.com/solr/my_collection/select?q=its_nid:$QA_NID"
drupal_9_json_api_endpoint="example.com/jsonapi/node/article?filter%5Bnid%5D=$DEV_NID"
drupal_10_json_api_endpoint="example.com/jsonapi/node/article?filter%5Bnid%5D=$QA_NID"

# Debug check, print endpoints in terminal
echo "Drupal 9 Solr endpoint: $drupal_9_solr_endpoint"
echo "Drupal 10 Solr endpoint: $drupal_10_solr_endpoint"
echo "Drupal 9 JSON API endpoint: $drupal_9_json_api_endpoint"
echo "Drupal 10 JSON API endpoint: $drupal_10_json_api_endpoint"

# Wait for 6 seconds for the json and solr endpoints to be available
sleep 6

# Send requests to Solr endpoints and save responses
curl -s "$drupal_9_solr_endpoint" | jq '.' > d9_solr_response.json
curl -s "$drupal_10_solr_endpoint" | jq '.' > d10_solr_response.json

# Send requests to JSON API endpoints and save responses
curl -s "$drupal_9_json_api_endpoint" | jq '.' > d9_json_api_response.json
curl -s "$drupal_10_json_api_endpoint" | jq '.' > d10_json_api_response.json

# Compare Solr data and create a report
diff -y --suppress-common-lines d9_solr_response.json d10_solr_response.json | awk '{ printf "%-5s %s\n", NR, $0 }' > solr_diff_report.txt

# Compare JSON API data and create a report
diff -y --suppress-common-lines d9_json_api_response.json d10_json_api_response.json | awk '{ printf "%-5s %s\n", NR, $0 }' > json_api_diff_report.txt

# Read the contents of the JSON files
content_a=$(<d9_json_api_response.json)
content_b=$(<d10_json_api_response.json)
content_solr_a=$(<d9_solr_response.json)
content_solr_b=$(<d10_solr_response.json)

# Escape any special characters in the content
escaped_a=$(printf '%s\n' "$content_a" | sed 's:[&/\]:\\&:g;$!s/$/\\/')
escaped_b=$(printf '%s\n' "$content_b" | sed 's:[&/\]:\\&:g;$!s/$/\\/')
escaped_solr_a=$(printf '%s\n' "$content_solr_a" | sed 's:[&/\]:\\&:g;$!s/$/\\/')
escaped_solr_b=$(printf '%s\n' "$content_solr_b" | sed 's:[&/\]:\\&:g;$!s/$/\\/')

# Create the index.html file with the contents embedded
cat <<EOF > index.html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Diff d9-d10 JSON Solr</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div id="container">
      <div id="contentA"> d9_json_api_response.json
          <textarea id="jsonA">$escaped_a</textarea>
      </div>
      <div id="contentB"> d10_json_api_response.json
          <textarea id="jsonB">$escaped_b</textarea>
      </div>
    </div>
    <button class="toggle-button" onclick="toggleVisibility('jsonResult')">Toggle JSON API Results</button>
    <pre id="json-output"><div id="jsonResult" class="collapsible-content"></div></pre>

    <div id="solrContainer">
      <div id="solrContentA"> d9_solr_response.json
          <textarea id="solrA">$escaped_solr_a</textarea>
      </div>
      <div id="solrContentB"> d10_solr_response.json
          <textarea id="solrB">$escaped_solr_b</textarea>
      </div>
    </div>
    <button class="toggle-button" onclick="toggleVisibility('solrResult')">Toggle Solr Results</button>
    <pre id="solr-output"><div id="solrResult" class="collapsible-content"></div></pre>

    <script src="index.js"></script>
    <script>
        function toggleVisibility(id) {
            var content = document.getElementById(id);
            if (content.style.display === "none") {
                content.style.display = "block";
            } else {
                content.style.display = "none";
            }
        }
    </script>
</body>
</html>
EOF

# Clean up temporary files
rm d9_solr_response.json d10_solr_response.json d9_json_api_response.json d10_json_api_response.json solr_diff_report.txt json_api_diff_report.txt

# open in browser
open index.html
