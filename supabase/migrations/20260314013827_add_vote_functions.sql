/*
  # Add Vote Helper Functions
  
  1. Functions
    - `increment_name_vote` - Increments the vote count for a name suggestion
    - `decrement_name_vote` - Decrements the vote count for a name suggestion
  
  2. Notes
    - These functions help maintain vote counts accurately
    - Used when users vote/unvote on name suggestions
*/

CREATE OR REPLACE FUNCTION increment_name_vote(vote_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE name_votes
  SET votes = votes + 1
  WHERE id = vote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_name_vote(vote_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE name_votes
  SET votes = GREATEST(0, votes - 1)
  WHERE id = vote_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;