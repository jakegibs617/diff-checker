# diff-checker

`$bash run.sh`

# before running

```
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
```

This area is a template for how to auto generate an article on your environment. Much of the structure here will need to be reworked to match your structure. I have kept only the basics to provide a demonstration.

The 2 calls initially create articles in both environments.

You will need to modify these solr and json api endpoints to match that of your site. The idea here is to pull only the result of your created node from above.

```
# Define the endpoints
drupal_9_solr_endpoint="example.com/solr/my_collection/select?q=its_nid:$DEV_NID"
drupal_10_solr_endpoint="example.com/solr/my_collection/select?q=its_nid:$QA_NID"
drupal_9_json_api_endpoint="example.com/jsonapi/node/article?filter%5Bnid%5D=$DEV_NID"
drupal_10_json_api_endpoint="example.com/jsonapi/node/article?filter%5Bnid%5D=$QA_NID"
```

The rest should be automated, it compares the 2 env for solr and json responses and populates the input fields with the results. Then shows a collapsable result. The input fields will remain editable so you can also use for other purposes as well.
