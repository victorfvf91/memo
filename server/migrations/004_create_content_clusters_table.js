exports.up = function(knex) {
  return knex.schema.createTable('content_clusters', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('content_id').references('id').inTable('content').onDelete('CASCADE');
    table.uuid('cluster_id').references('id').inTable('clusters').onDelete('CASCADE');
    table.decimal('similarity_score', 3, 2).defaultTo(0); // 0-1 similarity score
    table.boolean('is_primary').defaultTo(false); // Whether this is the primary cluster for the content
    table.timestamp('created_at').defaultTo(knex.fn.now());
    
    // Ensure unique content-cluster pairs
    table.unique(['content_id', 'cluster_id']);
    
    // Indexes for performance
    table.index('content_id');
    table.index('cluster_id');
    table.index('similarity_score');
    table.index('is_primary');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('content_clusters');
}; 