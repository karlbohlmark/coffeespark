(function() {
  var spark;
  spark = require('./spark');
  spark.render('<div class="test"><span>${title}</span><div partial="magicpartial" each="product in products">${product.name}<span each="tag in product.tags">${tag}</span></div></div>', {
    title: 'test',
    products: [
      {
        name: 'asdf',
        tags: ['cool']
      }
    ]
  });
}).call(this);
